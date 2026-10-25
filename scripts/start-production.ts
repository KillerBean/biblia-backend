if (process.env.SYNC_TRANSLATIONS_ON_START === 'true') {
    await import('./sync-translations.ts');
}

await import('../src/index.ts');
