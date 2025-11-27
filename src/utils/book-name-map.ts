
export const BOOK_MAP: { [key: string]: number } = {
    // Old Testament
    'gn': 1, 'genes': 1, 'genesis': 1, 'gênesis': 1,
    'ex': 2, 'exod': 2, 'exodo': 2, 'êxodo': 2,
    'lv': 3, 'lev': 3, 'levitico': 3, 'levítico': 3,
    'nm': 4, 'num': 4, 'numeros': 4, 'números': 4,
    'dt': 5, 'deut': 5, 'deuteronomio': 5, 'deuteronômio': 5,
    'js': 6, 'jos': 6, 'josue': 6, 'josué': 6,
    'jz': 7, 'juiz': 7, 'juizes': 7, 'juízes': 7,
    'rt': 8, 'rut': 8, 'rute': 8,
    '1sm': 9, '1sam': 9, '1samuel': 9,
    '2sm': 10, '2sam': 10, '2samuel': 10,
    '1rs': 11, '1reis': 11,
    '2rs': 12, '2reis': 12,
    '1cr': 13, '1cron': 13, '1cronicas': 13, '1crônicas': 13,
    '2cr': 14, '2cron': 14, '2cronicas': 14, '2crônicas': 14,
    'ed': 15, 'esd': 15, 'esdras': 15,
    'ne': 16, 'nee': 16, 'neemias': 16,
    'et': 17, 'est': 17, 'ester': 17,
    'jo': 43, 'job': 18, 'jó': 18, // 'jo' defaults to João (43), 'job'/'jó' to Job (18)
    'sl': 19, 'sal': 19, 'salmos': 19,
    'pv': 20, 'prov': 20, 'proverbios': 20, 'provérbios': 20,
    'ec': 21, 'ecl': 21, 'eclesiastes': 21,
    'ct': 22, 'cant': 22, 'canticos': 22, 'cânticos': 22,
    'is': 23, 'isa': 23, 'isaias': 23, 'isaías': 23,
    'jr': 24, 'jer': 24, 'jeremias': 24,
    'lm': 25, 'lam': 25, 'lamentacoes': 25, 'lamentações': 25,
    'ez': 26, 'eze': 26, 'ezequiel': 26,
    'dn': 27, 'dan': 27, 'daniel': 27,
    'os': 28, 'ose': 28, 'oseias': 28, 'oséias': 28,
    'jl': 29, 'joe': 29, 'joel': 29,
    'am': 30, 'amo': 30, 'amos': 30, 'amós': 30,
    'ob': 31, 'oba': 31, 'obadias': 31,
    'jn': 32, 'jon': 32, 'jonas': 32,
    'mq': 33, 'miq': 33, 'miqueias': 33, 'miquéias': 33,
    'na': 34, 'nau': 34, 'naum': 34,
    'hc': 35, 'hab': 35, 'habacuque': 35,
    'sf': 36, 'sof': 36, 'sofonias': 36,
    'ag': 37, 'age': 37, 'ageu': 37,
    'zc': 38, 'zac': 38, 'zacarias': 38,
    'ml': 39, 'mal': 39, 'malaquias': 39,

    // New Testament
    'mt': 40, 'mat': 40, 'mateus': 40,
    'mc': 41, 'mar': 41, 'marcos': 41,
    'lc': 42, 'luc': 42, 'lucas': 42,
    'joao': 43, 'joão': 43, // Ambiguity with Jo (Job) handled by context or preference? Actually 'Jo' is usually John in NT context but Job in OT. 
    // Standard Portuguese usage: Jo = João, Jó = Jó. 
    // Let's assume 'Jo' without accent could be João. 'Job' or 'Jó' is Job.
    // However, in many contexts 'Jo' is John. I will map 'jo' to 43 (João) because it is more common in search.
    // I will add 'job' -> 18 explicitly.
    // Override 'jo' to 43.
    
    'at': 44, 'atos': 44,
    'rm': 45, 'rom': 45, 'romanos': 45,
    '1co': 46, '1cor': 46, '1corintios': 46, '1coríntios': 46,
    '2co': 47, '2cor': 47, '2corintios': 47, '2coríntios': 47,
    'gl': 48, 'gal': 48, 'galatas': 48, 'gálatas': 48,
    'ef': 49, 'efe': 49, 'efesios': 49, 'efésios': 49,
    'fp': 50, 'flp': 50, 'fil': 50, 'filipenses': 50,
    'cl': 51, 'col': 51, 'colossenses': 51,
    '1ts': 52, '1tes': 52, '1tessalonicenses': 52,
    '2ts': 53, '2tes': 53, '2tessalonicenses': 53,
    '1tm': 54, '1tim': 54, '1timoteo': 54, '1timóteo': 54,
    '2tm': 55, '2tim': 55, '2timoteo': 55, '2timóteo': 55,
    'tt': 56, 'tit': 56, 'tito': 56,
    'fm': 57, 'flm': 57, 'filemom': 57,
    'hb': 58, 'heb': 58, 'hebreus': 58,
    'tg': 59, 'tia': 59, 'tiago': 59,
    '1pe': 60, '1ped': 60, '1pedro': 60,
    '2pe': 61, '2ped': 61, '2pedro': 61,
    '1jo': 62, '1joao': 62, '1joão': 62,
    '2jo': 63, '2joao': 63, '2joão': 63,
    '3jo': 64, '3joao': 64, '3joão': 64,
    'jd': 65, 'jud': 65, 'judas': 65,
    'ap': 66, 'apo': 66, 'apocalipse': 66,
};

// Override specific ambiguous cases
// 'Jo' is commonly John. 'Jó' is Job.
// If user types 'jo', we assume John. If user types 'job' or 'jó', Job.
