/**
 * Главная страница - навигация по курсу
 */

import { loadAllChapters, groupChaptersBySection } from './data-loader.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('course-content');
    const sectionsContainer = document.getElementById('sections-container');
    
    try {
        // Загружаем все главы
        const chapters = await loadAllChapters();
        
        // Группируем по разделам
        const sections = groupChaptersBySection(chapters);
        
        // Рендерим навигацию
        renderSections(sections, sectionsContainer);
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки курса:', error);
        loadingEl.textContent = 'Ошибка загрузки курса. Проверьте консоль для деталей.';
    }
});

/**
 * Рендерит список разделов и глав
 */
function renderSections(sections, container) {
    container.innerHTML = '';
    
    // Сортируем разделы по ID (можно улучшить, добавив order)
    const sectionIds = Object.keys(sections).sort();
    
    for (const sectionId of sectionIds) {
        const section = sections[sectionId];
        
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'section';
        
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        sectionHeader.innerHTML = `<h2>${section.title || sectionId}</h2>`;
        sectionDiv.appendChild(sectionHeader);
        
        const chaptersList = document.createElement('div');
        chaptersList.className = 'chapters-list';
        
        for (const chapter of section.chapters) {
            const chapterCard = document.createElement('div');
            chapterCard.className = 'chapter-card';
            
            const level = chapter.level ? `<span class="level-badge level-${chapter.level.toLowerCase()}">${chapter.level}</span>` : '';
            const minutes = chapter.estimated_minutes ? `<span class="minutes">~${chapter.estimated_minutes} мин</span>` : '';
            
            chapterCard.innerHTML = `
                <div class="chapter-card-header">
                    <h3>${chapter.title || chapter.title_short || chapter.id}</h3>
                    ${level} ${minutes}
                </div>
                ${chapter.description ? `<p class="chapter-description">${chapter.description}</p>` : ''}
                <div class="chapter-card-footer">
                    <a href="chapter.html?chapter=${encodeURIComponent(chapter.id)}" class="btn btn-primary">
                        Изучить главу
                    </a>
                </div>
            `;
            
            chaptersList.appendChild(chapterCard);
        }
        
        sectionDiv.appendChild(chaptersList);
        container.appendChild(sectionDiv);
    }
}
