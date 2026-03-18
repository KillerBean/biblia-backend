import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbFolder = join(__dirname, '../src/db/sqlite');

async function init() {
    console.log('🚀 Iniciando otimização dos bancos de dados...');
    
    try {
        const files = await readdir(dbFolder);
        const sqliteFiles = files.filter(f => f.endsWith('.sqlite'));

        for (const file of sqliteFiles) {
            const dbPath = join(dbFolder, file);
            console.log(`\n📦 Processando: ${file}`);
            
            const db = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });

            console.log('  - Criando índices...');
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_book_name ON book(name);
                CREATE INDEX IF NOT EXISTS idx_verse_book_chapter_verse ON verse(book_id, chapter, verse);
                CREATE INDEX IF NOT EXISTS idx_verse_text ON verse(text);
            `);

            console.log('  - Configurando WAL mode...');
            await db.run('PRAGMA journal_mode=WAL');

            await db.close();
            console.log(`  ✅ ${file} otimizado com sucesso.`);
        }
        
        console.log('\n✨ Todos os bancos de dados foram indexados!');
    } catch (err) {
        console.error('❌ Erro ao processar bancos de dados:', err);
        process.exit(1);
    }
}

init();
