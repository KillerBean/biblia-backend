import { parseArgs } from 'node:util';
import { importUsfmDirectory } from '../src/ingestion/import-usfm.ts';

const { values } = parseArgs({
    options: {
        source: { type: 'string' },
        translation: { type: 'string' },
        output: { type: 'string' },
    },
});
if (!values.source || !values.translation || !values.output) {
    throw new Error('Usage: npm run translation:import -- --source DIR --translation ID --output FILE');
}

console.log(JSON.stringify(await importUsfmDirectory({
    sourceDirectory: values.source,
    translationId: values.translation,
    output: values.output,
}), null, 2));
