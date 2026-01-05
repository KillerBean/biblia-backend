CREATE TABLE IF NOT EXISTS "book" (
	"id"	INTEGER,
	"book_reference_id"	INTEGER,
	"testament_reference_id"	INTEGER,
	"name"	TEXT
);
CREATE TABLE IF NOT EXISTS "metadata" (
	"key"	TEXT,
	"value"	TEXT
);
CREATE TABLE IF NOT EXISTS "testament" (
	"id"	INTEGER,
	"name"	TEXT
);
CREATE TABLE IF NOT EXISTS "verse" (
	"id"	INTEGER,
	"book_id"	INTEGER,
	"chapter"	INTEGER,
	"verse"	INTEGER,
	"text"	TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_book_name ON book(name);
CREATE INDEX IF NOT EXISTS idx_verse_book_chapter_verse ON verse(book_id, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_verse_text ON verse(text);