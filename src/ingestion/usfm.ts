export interface ParsedUsfmVerse {
    chapter: number;
    label: string;
    start: number;
    end: number;
    text: string;
}

export interface ParsedUsfmBook {
    osis: string;
    name: string;
    abbreviation: string;
    verses: ParsedUsfmVerse[];
}

function plainText(value: string): string {
    return value
        .replace(/\\(?:f|x)\s[\s\S]*?\\(?:f|x)\*/g, '')
        .replace(/\\w\s+([^|\\]+)(?:\|[^\\]*)?\\w\*/g, '$1')
        .replace(/\\[a-z][a-z0-9-]*\*/gi, '')
        .replace(/\\[a-z][a-z0-9-]*\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseUsfm(content: string): ParsedUsfmBook {
    const withoutNotes = content
        .replace(/\\f\s[\s\S]*?\\f\*/g, '')
        .replace(/\\x\s[\s\S]*?\\x\*/g, '');
    const lines = withoutNotes.replace(/\r\n?/g, '\n').split('\n');
    let osis = '';
    let name = '';
    let abbreviation = '';
    let chapter = 0;
    let activeVerse: ParsedUsfmVerse | undefined;
    const verses: ParsedUsfmVerse[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const id = /^\\id\s+([^\s]+)/.exec(line);
        if (id) {
            osis = id[1].toUpperCase();
            continue;
        }
        const header = /^\\h\s+(.+)$/.exec(line);
        if (header) {
            name = plainText(header[1]);
            continue;
        }
        const toc2 = /^\\toc2\s+(.+)$/.exec(line);
        if (toc2 && !name) {
            name = plainText(toc2[1]);
            continue;
        }
        const toc3 = /^\\toc3\s+(.+)$/.exec(line);
        if (toc3) {
            abbreviation = plainText(toc3[1]);
            continue;
        }
        const chapterMarker = /^\\c\s+(\d+)/.exec(line);
        if (chapterMarker) {
            chapter = Number(chapterMarker[1]);
            activeVerse = undefined;
            continue;
        }
        const verseMarker = /^\\v\s+(\d+)(?:-(\d+))?\s*(.*)$/.exec(line);
        if (verseMarker) {
            if (chapter < 1) throw new Error(`Verse appears before a chapter in ${osis || 'unknown book'}`);
            const start = Number(verseMarker[1]);
            const end = Number(verseMarker[2] ?? verseMarker[1]);
            activeVerse = {
                chapter,
                label: verseMarker[2] ? `${start}-${end}` : String(start),
                start,
                end,
                text: plainText(verseMarker[3]),
            };
            verses.push(activeVerse);
            continue;
        }

        if (activeVerse && !/^\\(?:s\d*|ms\d*|mr|r|d|cl|cp|b|nb|ib|ie)\b/.test(line)) {
            const continuation = plainText(line);
            if (continuation) activeVerse.text = `${activeVerse.text} ${continuation}`.trim();
        }
    }

    if (!osis || !name || verses.length === 0) {
        throw new Error(`Incomplete USFM book: id=${osis || '-'}, name=${name || '-'}, verses=${verses.length}`);
    }
    return { osis, name, abbreviation: abbreviation || osis, verses };
}
