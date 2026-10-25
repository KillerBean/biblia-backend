import { createHash, randomBytes } from 'node:crypto';

const key = `bbl_${randomBytes(32).toString('base64url')}`;
const keyHash = createHash('sha256').update(key).digest('hex');
console.log(JSON.stringify({
    apiKey: key,
    sha256: keyHash,
    consumerRecord: { id: 'replace-consumer-id', keyHash, scopes: ['bible:read'] },
    warning: 'Show apiKey once; store only consumerRecord in PUBLIC_API_CONSUMERS_JSON.',
}, null, 2));
