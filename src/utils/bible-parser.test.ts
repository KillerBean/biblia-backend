
import { BibleParser } from './bible-parser.ts';

describe('BibleParser', () => {
    // Scenario 1: Chapter and Verse with comma
    // "Jo 3,16" -> João (43), Chapter 3, Verse 16
    it('should parse "Chapter and Verse" with comma separator (Jo 3,16)', () => {
        const result = BibleParser.parse('Jo 3,16');
        expect(result.type).toBe('reference');
        expect(result.references).toHaveLength(1);
        expect(result.references![0]).toEqual({
            bookId: 43, // João
            chapter: 3,
            verse: 16
        });
    });

    // Scenario 2: Continuous Range of Verses
    // "Mateus 5:1-10" -> Mateus (40), Chapter 5, Verse 1 to 10
    it('should parse "Continuous Range of Verses" (Mateus 5:1-10)', () => {
        const result = BibleParser.parse('Mateus 5:1-10');
        expect(result.type).toBe('reference');
        expect(result.references).toHaveLength(1);
        expect(result.references![0]).toEqual({
            bookId: 40, // Mateus
            chapter: 5,
            verse: 1,
            endVerse: 10
        });
    });

    // Scenario 3: Non-Consecutive Verses
    // "Salmos 23:1,4" -> Salmos (19), Chapter 23, Verses 1 and 4
    // Note: The parser implementation logic for ',' inside verse part:
    // if (versePart.includes(',') || versePart.includes(';'))
    it('should parse "Non-Consecutive Verses" (Salmos 23:1,4)', () => {
        const result = BibleParser.parse('Salmos 23:1,4');
        expect(result.type).toBe('reference');
        expect(result.references).toHaveLength(1);
        expect(result.references![0]).toEqual({
            bookId: 19, // Salmos
            chapter: 23,
            verses: [1, 4]
        });
    });

    // Scenario 4: Chapter Range
    // "Gênesis 1-3" -> Gênesis (1), Chapter 1 to 3 (whole chapters)
    it('should parse "Chapter Range" (Gênesis 1-3)', () => {
        const result = BibleParser.parse('Gênesis 1-3');
        expect(result.type).toBe('reference');
        expect(result.references).toHaveLength(1);
        expect(result.references![0]).toEqual({
            bookId: 1, // Gênesis
            chapter: 1,
            endChapter: 3
        });
    });

    // Scenario 5: Multiple References
    // "Jo 3,16; Rm 8,28" -> João 3:16 AND Romanos 8:28
    it('should parse "Multiple References" separated by semicolon (Jo 3,16; Rm 8,28)', () => {
        const result = BibleParser.parse('Jo 3,16; Rm 8,28');
        expect(result.type).toBe('reference');
        expect(result.references).toHaveLength(2);
        
        // Sort or access by index? The order should be preserved.
        expect(result.references![0]).toEqual({
            bookId: 43, // João
            chapter: 3,
            verse: 16
        });
        expect(result.references![1]).toEqual({
            bookId: 45, // Romanos
            chapter: 8,
            verse: 28
        });
    });
});
