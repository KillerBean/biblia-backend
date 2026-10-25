import { parseUsfm } from './usfm.ts';

describe('USFM ingestion', () => {
    it('preserves verse text and removes notes and inline markers', () => {
        const book = parseUsfm(String.raw`\id JHN - Example
\h João
\toc3 Jo
\c 3
\p
\v 16 Porque Deus \wj amou\wj* o mundo. \f + \fr 3.16 \ft Nota editorial.\f*
\p Continuação do mesmo versículo.
\v 17 Texto seguinte.`);

        expect(book).toMatchObject({ osis: 'JHN', name: 'João', abbreviation: 'Jo' });
        expect(book.verses).toEqual([
            { chapter: 3, label: '16', start: 16, end: 16, text: 'Porque Deus amou o mundo. Continuação do mesmo versículo.' },
            { chapter: 3, label: '17', start: 17, end: 17, text: 'Texto seguinte.' },
        ]);
    });

    it('supports joined verse labels without losing their range', () => {
        const book = parseUsfm(String.raw`\id PSA
\h Salmos
\c 1
\v 1-2 Texto agrupado.`);
        expect(book.verses[0]).toMatchObject({ label: '1-2', start: 1, end: 2 });
    });
});
