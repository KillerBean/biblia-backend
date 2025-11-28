import { BOOK_MAP } from './book-name-map.ts';

export interface Reference {
    bookId: number;
    chapter?: number;
    endChapter?: number;
    verse?: number;
    endVerse?: number;
    verses?: number[]; // For non-consecutive verses
}

export interface SearchQuery {
    type: 'reference' | 'text';
    references?: Reference[];
    text?: string;
}

export class BibleParser {
    static parse(input: string): SearchQuery {
        const trimmedInput = input.trim();
        if (!trimmedInput) return { type: 'text', text: '' };

        // Try to parse as reference(s)
        const references = this.parseReferences(trimmedInput);
        
        if (references.length > 0) {
            // Check if the entire string was consumed by references or if it looks like a valid ref
            // Simple check: valid references found.
            return { type: 'reference', references };
        }

        return { type: 'text', text: trimmedInput };
    }

    private static parseReferences(input: string): Reference[] {
        const parts = input.split(';');
        const references: Reference[] = [];

        for (const part of parts) {
            const ref = this.parseSingleReference(part.trim());
            if (ref) {
                references.push(ref);
            } else if (part.trim().length > 0) {
                // If any part fails to parse as a reference, and it's not empty,
                // treat the WHOLE input as text search? 
                // Or just ignore this part?
                // For safety, if we can't parse a part that looks like it should be a reference,
                // we might be in a text search scenario (e.g. "Jesus wept;").
                // But let's be strict: if we found SOME references but this part failed, 
                // maybe it's just a bad reference.
                // However, the requirement is "Search by text".
                // If input is "God is love", "God" might match a book? No.
                // If input is "Jo 3:16", it matches.
                // If input is "Jo 3:16; Rm 8:28", both match.
                // If input is "Love one another", no book matches.
                return []; // Fail reference parsing, fallback to text.
            }
        }
        return references;
    }

    private static findBookMatch(input: string): { bookId: number; length: number } {
        let bestMatchBookId = 0;
        let bestMatchLen = 0;

        const lowerInput = input.toLowerCase();

        for (const key of Object.keys(BOOK_MAP)) {
            if (lowerInput.startsWith(key)) {
                const nextChar = lowerInput[key.length];
                if (!nextChar || /[\d\s.:,-]/.test(nextChar)) {
                    if (key.length > bestMatchLen) {
                        bestMatchBookId = BOOK_MAP[key];
                        bestMatchLen = key.length;
                    }
                }
            }
        }

        return { bookId: bestMatchBookId, length: bestMatchLen };
    }

    private static parseChapterAndVerses(bookId: number, rest: string): Reference {
        const cleanRest = rest.replaceAll(/\s*([:\-,])\s*/g, '$1');
        const chapMatch = new RegExp(/^(\d+)(.*)$/).exec(cleanRest);
        
        if (!chapMatch) {
            return { bookId };
        }

        const chapter = Number.parseInt(chapMatch[1]);
        const remainder = chapMatch[2];

        if (!remainder) {
            return { bookId, chapter };
        }

        const separator = remainder[0];
        const afterSep = remainder.substring(1);

        if (separator === '-') {
            const endChapMatch = new RegExp(/^(\d+)/).exec(afterSep);
            if (endChapMatch) {
                return { 
                    bookId, 
                    chapter, 
                    endChapter: Number.parseInt(endChapMatch[1]) 
                };
            }
        } else if (separator === ':' || separator === ',') {
            return this.parseVerses(bookId, chapter, afterSep);
        }

        return { bookId, chapter };
    }

    private static parseSingleReference(input: string): Reference | null {
        const { bookId: bestMatchBookId, length: bestMatchLen } = this.findBookMatch(input);

        if (bestMatchBookId === 0) {
            return null;
        }

        const rest = input.substring(bestMatchLen).trim();
        if (rest.length === 0) {
            return { bookId: bestMatchBookId };
        }

        return this.parseChapterAndVerses(bestMatchBookId, rest);
    }

    private static parseVerses(bookId: number, chapter: number, versePart: string): Reference {
        // versePart could be "16", "16-18", "16,18", "1,4-6"
        // Simple cases first
        
        // Check for range "-"
        // Note: User said "Salmos 23:1,4" uses comma for list.
        // But "Jo 3,16" uses comma for separator.
        // Here we are AFTER the first separator. So "16" or "1,4" or "1-4".
        
        if (versePart.includes('-')) {
            const [start, end] = versePart.split('-');
            return {
                bookId,
                chapter,
                verse: Number.parseInt(start),
                endVerse: Number.parseInt(end)
            };
        }
        
        if (versePart.includes(',') || versePart.includes(';')) {
            // List of verses
            // Split by comma (and semicolon if used for verses, though mostly used for refs)
            // User said "23:1,4".
            const verseStrs = versePart.split(/[,;]/).filter(s => s.trim().length > 0);
            const verses = verseStrs.map(v => Number.parseInt(v)).filter(n => !Number.isNaN(n));
            return {
                bookId,
                chapter,
                verses
            };
        }

        // Single verse
        const v = Number.parseInt(versePart);
        if (!Number.isNaN(v)) {
            return { bookId, chapter, verse: v };
        }

        return { bookId, chapter };
    }
}
