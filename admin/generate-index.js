#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Генерирует index.json со списком всех глав
const chaptersDir = path.join(__dirname, '..', 'chapters');
const outputFile = path.join(__dirname, 'data', 'chapters-index.json');

// Создаем папку data если её нет
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const chapters = [];

if (fs.existsSync(chaptersDir)) {
    const entries = fs.readdirSync(chaptersDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const chapterId = entry.name;
            const chapterPath = path.join(chaptersDir, chapterId);
            
            // Проверяем наличие основных файлов
            const hasOutline = fs.existsSync(path.join(chapterPath, '01-outline.json'));
            const hasFinal = fs.existsSync(path.join(chapterPath, '05-final.json'));
            
            if (hasOutline || hasFinal) {
                chapters.push({
                    id: chapterId,
                    path: `chapters/${chapterId}/`
                });
            }
        }
    }
}

// Сортируем по ID (можно будет улучшить, загрузив order из файлов)
chapters.sort((a, b) => a.id.localeCompare(b.id));

const index = {
    generated_at: new Date().toISOString(),
    total: chapters.length,
    chapters: chapters
};

fs.writeFileSync(outputFile, JSON.stringify(index, null, 2), 'utf8');
console.log(`Сгенерирован индекс: ${chapters.length} глав`);
console.log(`Файл: ${outputFile}`);
