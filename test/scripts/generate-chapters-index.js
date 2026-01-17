#!/usr/bin/env node

/**
 * Генерирует индексный файл со списком всех глав для тестовой системы
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CHAPTERS_DIR = path.join(PROJECT_ROOT, 'chapters');
const INDEX_FILE = path.join(PROJECT_ROOT, 'test', 'data', 'chapters-index.json');

// Находим все папки с главами
function findChapters() {
    const chapters = [];
    
    if (!fs.existsSync(CHAPTERS_DIR)) {
        console.error(`Папка chapters не найдена: ${CHAPTERS_DIR}`);
        return [];
    }
    
    const entries = fs.readdirSync(CHAPTERS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const chapterDir = path.join(CHAPTERS_DIR, entry.name);
            const finalFile = path.join(chapterDir, '05-final.json');
            
            if (fs.existsSync(finalFile)) {
                try {
                    const chapterData = JSON.parse(fs.readFileSync(finalFile, 'utf8'));
                    chapters.push({
                        id: chapterData.id,
                        section_id: chapterData.section_id,
                        title: chapterData.title || chapterData.title_short || chapterData.id,
                        title_short: chapterData.title_short,
                        level: chapterData.level,
                        order: chapterData.order || 0
                    });
                } catch (error) {
                    console.warn(`Ошибка чтения главы ${entry.name}:`, error.message);
                }
            }
        }
    }
    
    // Сортируем по order
    chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    return chapters;
}

// Генерируем индекс
function generateIndex() {
    console.log('Поиск глав...');
    const chapters = findChapters();
    
    const index = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        chapters: chapters
    };
    
    // Создаем папку data если её нет
    const dataDir = path.dirname(INDEX_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Сохраняем индекс
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
    
    console.log(`✓ Индекс создан: ${INDEX_FILE}`);
    console.log(`✓ Найдено глав: ${chapters.length}`);
    
    return index;
}

if (require.main === module) {
    generateIndex();
}

module.exports = { generateIndex, findChapters };
