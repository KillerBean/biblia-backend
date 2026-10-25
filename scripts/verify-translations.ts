import { loadTranslationRegistry } from '../src/catalog/translation-registry.ts';

const registry = await loadTranslationRegistry();
const approved = registry.translations.filter((item) => item.status !== 'license-review');
console.log(`Verified ${registry.translations.length} translations; ${approved.length} approved for ingestion.`);
