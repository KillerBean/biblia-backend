#!/usr/bin/env python3
"""Relationship-aware GHCR retention for signed production images.

The default mode is a read-only plan. Deletion requires --execute plus an exact
confirmation value in GHCR_RETENTION_CONFIRM. Unknown or incomplete OCI graphs
are preserved and make deletion fail closed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from pathlib import Path
from typing import Any


DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
IMAGE_MEDIA_TYPES = {
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.oci.image.index.v1+json",
}
DEPLOY_ARTIFACT_TYPE = "application/vnd.roseno.deploy.v1+json"
OIDC_ISSUER = "https://token.actions.githubusercontent.com"
RESERVED_TAGS = {"buildcache", "deploy-production", "latest"}


class RetentionError(RuntimeError):
    pass


def run(command: list[str], *, cwd: str | None = None) -> str:
    result = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()
        message = detail[-1] if detail else f"exit status {result.returncode}"
        raise RetentionError(f"command failed ({command[0]}): {message}")
    return result.stdout


def parse_time(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


class GitHubPackages:
    def __init__(self, owner: str, package: str, token: str) -> None:
        self.owner = owner
        self.package = package
        self.token = token
        owner_q = urllib.parse.quote(owner, safe="")
        package_q = urllib.parse.quote(package, safe="")
        self.base = (
            f"https://api.github.com/users/{owner_q}/packages/container/"
            f"{package_q}/versions"
        )

    def request(self, url: str, method: str = "GET") -> tuple[int, bytes]:
        request = urllib.request.Request(
            url,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "roseno-ghcr-retention/1",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")[:500]
            raise RetentionError(
                f"GitHub Packages API {method} failed with HTTP {error.code}: {body}"
            ) from error

    def versions(self) -> list[dict[str, Any]]:
        versions: list[dict[str, Any]] = []
        page = 1
        while True:
            status, body = self.request(f"{self.base}?per_page=100&page={page}")
            if status != 200:
                raise RetentionError(f"unexpected package list status: {status}")
            batch = json.loads(body)
            if not isinstance(batch, list):
                raise RetentionError("package versions response is not an array")
            versions.extend(batch)
            if len(batch) < 100:
                return versions
            page += 1

    def delete(self, version_id: int) -> None:
        status, _ = self.request(f"{self.base}/{version_id}", method="DELETE")
        if status != 204:
            raise RetentionError(
                f"unexpected delete status for package version {version_id}: {status}"
            )


def normalize_versions(raw: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    versions: dict[str, dict[str, Any]] = {}
    for item in raw:
        digest = item.get("name")
        version_id = item.get("id")
        updated_at = item.get("updated_at")
        tags = item.get("metadata", {}).get("container", {}).get("tags", [])
        if not isinstance(digest, str) or not DIGEST_RE.fullmatch(digest):
            raise RetentionError(f"invalid package version digest: {digest!r}")
        if not isinstance(version_id, int) or not isinstance(updated_at, str):
            raise RetentionError(f"invalid package version metadata for {digest}")
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            raise RetentionError(f"invalid tag metadata for {digest}")
        if digest in versions:
            raise RetentionError(f"duplicate package version digest: {digest}")
        versions[digest] = {
            "id": version_id,
            "digest": digest,
            "tags": sorted(tags),
            "updated_at": updated_at,
        }
    return versions


def descriptor_digest(reference: str) -> str:
    descriptor = json.loads(run(["oras", "manifest", "fetch", "--descriptor", reference]))
    digest = descriptor.get("digest")
    if not isinstance(digest, str) or not DIGEST_RE.fullmatch(digest):
        raise RetentionError(f"invalid descriptor digest for {reference}")
    return digest


def fetch_manifest(repository: str, digest: str) -> dict[str, Any]:
    manifest = json.loads(run(["oras", "manifest", "fetch", f"{repository}@{digest}"]))
    if not isinstance(manifest, dict):
        raise RetentionError(f"manifest is not an object: {digest}")
    return manifest


def verify_signature(repository: str, digest: str, identity: str) -> None:
    run(
        [
            "cosign",
            "verify",
            "--certificate-identity",
            identity,
            "--certificate-oidc-issuer",
            OIDC_ISSUER,
            f"{repository}@{digest}",
        ]
    )


def discover_referrers(repository: str, digest: str) -> set[str]:
    document = json.loads(
        run(["oras", "discover", "--format", "json", f"{repository}@{digest}"])
    )
    found: set[str] = set()

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            candidate = value.get("digest")
            if isinstance(candidate, str) and DIGEST_RE.fullmatch(candidate):
                found.add(candidate)
            for child in value.get("referrers", []):
                walk(child)

    for referrer in document.get("referrers", []):
        walk(referrer)
    return found


def load_deploy_manifest(
    repository: str,
    deploy_digest: str,
    expected_service: str,
    expected_source: str,
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="ghcr-retention-") as directory:
        run(["oras", "pull", f"{repository}@{deploy_digest}", "--output", directory])
        path = Path(directory) / "deploy-manifest.json"
        if not path.is_file():
            raise RetentionError("deploy-production does not contain deploy-manifest.json")
        manifest = json.loads(path.read_text(encoding="utf-8"))
    required = {
        "schema_version": 1,
        "service": expected_service,
        "image_repository": repository,
        "source_repository": expected_source,
    }
    for field, expected in required.items():
        if manifest.get(field) != expected:
            raise RetentionError(f"deploy manifest {field} mismatch")
    image_digest = manifest.get("image_digest")
    commit = manifest.get("commit_sha")
    sequence = manifest.get("sequence")
    if not isinstance(image_digest, str) or not DIGEST_RE.fullmatch(image_digest):
        raise RetentionError("deploy manifest has invalid image digest")
    if not isinstance(commit, str) or not COMMIT_RE.fullmatch(commit):
        raise RetentionError("deploy manifest has invalid commit SHA")
    if not isinstance(sequence, int) or sequence < 1:
        raise RetentionError("deploy manifest has invalid sequence")
    return manifest


def manifest_subject(manifest: dict[str, Any]) -> str | None:
    subject = manifest.get("subject")
    if subject is None:
        return None
    digest = subject.get("digest") if isinstance(subject, dict) else None
    if not isinstance(digest, str) or not DIGEST_RE.fullmatch(digest):
        raise RetentionError("manifest has an invalid subject digest")
    return digest


def manifest_children(manifest: dict[str, Any]) -> set[str]:
    children: set[str] = set()
    entries = manifest.get("manifests", [])
    if entries is None:
        return children
    if not isinstance(entries, list):
        raise RetentionError("manifest list has invalid children")
    for entry in entries:
        digest = entry.get("digest") if isinstance(entry, dict) else None
        if not isinstance(digest, str) or not DIGEST_RE.fullmatch(digest):
            raise RetentionError("manifest list has an invalid child digest")
        children.add(digest)
    return children


def compute_plan(
    *,
    versions: dict[str, dict[str, Any]],
    manifests: dict[str, dict[str, Any]],
    active_roots: set[str],
    manual_fallback_digests: set[str],
    rollback_digests: list[str],
    discovered: set[str],
    minimum_age_days: int,
    now: dt.datetime,
) -> dict[str, Any]:
    errors: list[str] = []
    preserve_reasons: dict[str, set[str]] = defaultdict(set)
    subject_children: dict[str, set[str]] = defaultdict(set)
    index_children: dict[str, set[str]] = defaultdict(set)
    subjects: dict[str, str] = {}

    if set(versions) != set(manifests):
        errors.append("inventory is incomplete: not every package version has a manifest")

    for digest, manifest in manifests.items():
        try:
            subject = manifest_subject(manifest)
            if subject:
                subjects[digest] = subject
                subject_children[subject].add(digest)
            index_children[digest].update(manifest_children(manifest))
        except RetentionError as error:
            errors.append(f"{digest}: {error}")

    for digest in active_roots:
        preserve_reasons[digest].add("active-production-root")
    for digest in manual_fallback_digests:
        preserve_reasons[digest].add("manual-emergency-fallback")
    for digest in rollback_digests:
        preserve_reasons[digest].add("signed-rollback-image")
    for digest, version in versions.items():
        reserved = RESERVED_TAGS.intersection(version["tags"])
        if reserved:
            preserve_reasons[digest].add(f"reserved-tag:{','.join(sorted(reserved))}")

    queue = deque(preserve_reasons)
    while queue:
        digest = queue.popleft()
        related = subject_children.get(digest, set()) | index_children.get(digest, set())
        for child in related:
            if child in versions and not preserve_reasons[child]:
                preserve_reasons[child].add(f"reachable-from:{digest}")
                queue.append(child)

    for digest in discovered:
        if digest in versions:
            preserve_reasons[digest].add("discovered-referrer-of-protected-root")

    eligible_roots: set[str] = set()
    cutoff = now - dt.timedelta(days=minimum_age_days)
    for digest, version in versions.items():
        if preserve_reasons[digest] or digest in subjects:
            continue
        manifest = manifests.get(digest, {})
        updated = parse_time(version["updated_at"])
        if updated > cutoff:
            preserve_reasons[digest].add("younger-than-minimum-age")
            continue
        media_type = manifest.get("mediaType")
        artifact_type = manifest.get("artifactType")
        commit_tags = [tag for tag in version["tags"] if COMMIT_RE.fullmatch(tag)]
        if artifact_type == DEPLOY_ARTIFACT_TYPE:
            eligible_roots.add(digest)
        elif media_type in IMAGE_MEDIA_TYPES and commit_tags:
            eligible_roots.add(digest)
        else:
            preserve_reasons[digest].add("unclassified-or-untagged-root")

    delete_digests: set[str] = set()
    family_root: dict[str, str] = {}
    for root in eligible_roots:
        family = {root}
        queue = deque([root])
        while queue:
            parent = queue.popleft()
            for child in subject_children.get(parent, set()) | index_children.get(parent, set()):
                if child in versions and child not in family:
                    family.add(child)
                    queue.append(child)
        protected_digests = {
            digest for digest, reasons in preserve_reasons.items() if reasons
        }
        if family.intersection(protected_digests):
            preserve_reasons[root].add("family-intersects-protected-version")
            continue
        for digest in family:
            delete_digests.add(digest)
            family_root[digest] = root

    for digest in versions:
        if digest not in delete_digests and not preserve_reasons[digest]:
            preserve_reasons[digest].add("orphan-or-unselected-related-artifact")

    def depth(digest: str) -> int:
        value = 0
        seen: set[str] = set()
        while digest in subjects and digest not in seen:
            seen.add(digest)
            digest = subjects[digest]
            value += 1
        return value

    deletions = [
        {
            **versions[digest],
            "family_root": family_root[digest],
            "depth": depth(digest),
        }
        for digest in sorted(
            delete_digests,
            key=lambda item: (depth(item), versions[item]["updated_at"]),
            reverse=True,
        )
    ]
    preserved = [
        {**versions[digest], "reasons": sorted(reasons)}
        for digest, reasons in sorted(preserve_reasons.items())
        if digest in versions and digest not in delete_digests
    ]
    return {
        "safe_to_execute": not errors,
        "errors": errors,
        "counts": {
            "versions": len(versions),
            "preserved": len(preserved),
            "delete_candidates": len(deletions),
            "eligible_families": len({entry["family_root"] for entry in deletions}),
        },
        "rollback_digests": rollback_digests,
        "preserved": preserved,
        "deletions": deletions,
    }


def inventory(args: argparse.Namespace, api: GitHubPackages) -> dict[str, Any]:
    deploy_ref = f"{args.repository}:deploy-production"
    deploy_digest = descriptor_digest(deploy_ref)
    verify_signature(args.repository, deploy_digest, args.identity)
    deploy = load_deploy_manifest(
        args.repository,
        deploy_digest,
        args.service,
        args.source_repository,
    )
    image_digest = deploy["image_digest"]
    if descriptor_digest(f"{args.repository}@{image_digest}") != image_digest:
        raise RetentionError("active image descriptor mismatch")
    verify_signature(args.repository, image_digest, args.identity)

    versions = normalize_versions(api.versions())
    if deploy_digest not in versions or image_digest not in versions:
        raise RetentionError("active production digests are absent from package inventory")
    manual_fallbacks = set(args.protected_digest)
    invalid_fallbacks = [
        digest for digest in manual_fallbacks if not DIGEST_RE.fullmatch(digest)
    ]
    if invalid_fallbacks:
        raise RetentionError("manual fallback list contains an invalid digest")
    missing_fallbacks = manual_fallbacks.difference(versions)
    if missing_fallbacks:
        raise RetentionError(
            "manual fallback digests are absent from package inventory: "
            + ", ".join(sorted(missing_fallbacks))
        )

    manifests: dict[str, dict[str, Any]] = {}
    for digest in versions:
        manifests[digest] = fetch_manifest(args.repository, digest)

    signed_images: list[str] = [image_digest]
    ordered = sorted(
        versions.values(), key=lambda version: version["updated_at"], reverse=True
    )
    signature_failures: list[str] = []
    for version in ordered:
        digest = version["digest"]
        if digest == image_digest:
            continue
        if not any(COMMIT_RE.fullmatch(tag) for tag in version["tags"]):
            continue
        if manifests[digest].get("mediaType") not in IMAGE_MEDIA_TYPES:
            continue
        try:
            verify_signature(args.repository, digest, args.identity)
        except RetentionError:
            signature_failures.append(digest)
            continue
        signed_images.append(digest)

    rollback_digests = signed_images[: args.keep_images]
    discovered: set[str] = set()
    for root in {deploy_digest, *rollback_digests}:
        discovered.update(discover_referrers(args.repository, root))

    plan = compute_plan(
        versions=versions,
        manifests=manifests,
        active_roots={deploy_digest, image_digest},
        manual_fallback_digests=manual_fallbacks,
        rollback_digests=rollback_digests,
        discovered=discovered,
        minimum_age_days=args.minimum_age_days,
        now=dt.datetime.now(dt.timezone.utc),
    )
    plan.update(
        {
            "schema_version": 1,
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "owner": args.owner,
            "package": args.package,
            "repository": args.repository,
            "service": args.service,
            "minimum_age_days": args.minimum_age_days,
            "keep_images": args.keep_images,
            "active": {
                "deploy_digest": deploy_digest,
                "image_digest": image_digest,
                "commit_sha": deploy["commit_sha"],
                "sequence": deploy["sequence"],
            },
            "unsigned_or_unverifiable_commit_images": signature_failures,
            "manual_fallback_digests": sorted(manual_fallbacks),
        }
    )
    return plan


def execute_plan(args: argparse.Namespace, api: GitHubPackages, plan: dict[str, Any]) -> None:
    expected = f"DELETE {args.package}"
    if os.environ.get("GHCR_RETENTION_CONFIRM") != expected:
        raise RetentionError(
            f"refusing deletion: GHCR_RETENTION_CONFIRM must equal {expected!r}"
        )
    if not plan["safe_to_execute"]:
        raise RetentionError("refusing deletion: plan is not safe to execute")
    for entry in plan["deletions"]:
        api.delete(entry["id"])

    active = plan["active"]
    current_deploy = descriptor_digest(f"{args.repository}:deploy-production")
    if current_deploy != active["deploy_digest"]:
        raise RetentionError("deploy-production changed during retention")
    verify_signature(args.repository, current_deploy, args.identity)
    current_manifest = load_deploy_manifest(
        args.repository,
        current_deploy,
        args.service,
        args.source_repository,
    )
    if current_manifest["image_digest"] != active["image_digest"]:
        raise RetentionError("active image changed during retention")
    for digest in plan["rollback_digests"]:
        if descriptor_digest(f"{args.repository}@{digest}") != digest:
            raise RetentionError(f"protected image disappeared after deletion: {digest}")
        verify_signature(args.repository, digest, args.identity)
    remaining = normalize_versions(api.versions())
    protected = {
        current_deploy,
        *plan["rollback_digests"],
        *plan["manual_fallback_digests"],
    }
    missing = protected.difference(remaining)
    if missing:
        raise RetentionError(
            "protected package versions disappeared after deletion: "
            + ", ".join(sorted(missing))
        )


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--service", required=True)
    parser.add_argument("--source-repository", required=True)
    parser.add_argument("--identity", required=True)
    parser.add_argument("--keep-images", type=int, default=5)
    parser.add_argument("--minimum-age-days", type=int, default=30)
    parser.add_argument("--output", default="ghcr-retention-plan.json")
    parser.add_argument(
        "--protected-digest",
        action="append",
        default=[],
        help="preserve an additional immutable emergency fallback digest",
    )
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.keep_images < 2:
        parser.error("--keep-images must be at least 2")
    if args.minimum_age_days < 7:
        parser.error("--minimum-age-days must be at least 7")
    expected_repository = f"ghcr.io/{args.owner.lower()}/{args.package.lower()}"
    if args.repository.lower() != expected_repository:
        parser.error(f"--repository must equal {expected_repository}")
    return args


def main() -> int:
    args = arguments()
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RetentionError("GH_TOKEN or GITHUB_TOKEN is required")
    for command in ("oras", "cosign"):
        if not shutil_which(command):
            raise RetentionError(f"required command is missing: {command}")
    api = GitHubPackages(args.owner, args.package, token)
    plan = inventory(args, api)
    Path(args.output).write_text(
        json.dumps(plan, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        f"package={args.package} versions={plan['counts']['versions']} "
        f"preserved={plan['counts']['preserved']} "
        f"delete_candidates={plan['counts']['delete_candidates']} "
        f"safe_to_execute={str(plan['safe_to_execute']).lower()}"
    )
    if args.execute:
        execute_plan(args, api, plan)
        print(f"deleted_versions={plan['counts']['delete_candidates']}")
    else:
        print("mode=dry-run (no package versions were deleted)")
    return 0


def shutil_which(command: str) -> str | None:
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        candidate = Path(directory) / command
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RetentionError, json.JSONDecodeError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
