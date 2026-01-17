/**
 * Главная страница - навигация по курсу
 */

import { loadAllChapters, groupChaptersBySection } from './data-loader.js';
import { getTestResults } from './test-results.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('course-content');
    const sectionsContainer = document.getElementById('sections-container');
    
    try {
        // Загружаем все главы
        const chapters = await loadAllChapters();
        
        // Группируем по разделам
        const sections = await groupChaptersBySection(chapters);
        
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
    
    // Получаем результаты тестов
    const testResults = getTestResults();
    
    // Сортируем разделы по order (по возрастанию: 0, 1, 2, ...)
    const sectionArray = Object.values(sections);
    sectionArray.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999;
        const orderB = typeof b.order === 'number' ? b.order : 999;
        // Сортировка по возрастанию: меньший order идет первым
        return orderA - orderB;
    });
    
    // Отладочная информация
    if (sectionArray.length > 0) {
        console.log('Порядок разделов:', sectionArray.map(s => `${s.id} (order=${s.order})`).join(', '));
    }
    
    for (const section of sectionArray) {
        
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
            
            // Получаем результат теста для этой главы
            const testResult = testResults[chapter.id];
            
            const level = chapter.level ? `<span class="level-badge level-${chapter.level.toLowerCase()}">${chapter.level}</span>` : '';
            const minutes = chapter.estimated_minutes ? `<span class="minutes">~${chapter.estimated_minutes} мин</span>` : '';
            
            // Формируем блок с результатом теста
            let testResultHtml = '';
            if (testResult) {
                const resultClass = testResult.percentage >= 70 ? 'test-result-passed' : 'test-result-failed';
                testResultHtml = `
                    <div class="test-result-badge ${resultClass}">
                        <div class="test-result-score">${testResult.score}/${testResult.total}</div>
                        <div class="test-result-percentage">${testResult.percentage}%</div>
                        <div class="test-result-date">${new Date(testResult.completedAt).toLocaleDateString('ru-RU')}</div>
                    </div>
                `;
            }
            
            chapterCard.innerHTML = `
                <div class="chapter-card-header">
                    <h3>${chapter.title || chapter.title_short || chapter.id}</h3>
                    ${level} ${minutes}
                </div>
                ${chapter.description ? `<p class="chapter-description">${chapter.description}</p>` : ''}
                ${testResultHtml}
                <div class="chapter-card-footer">
                    <a href="chapter.html?chapter=${encodeURIComponent(chapter.id)}" class="btn btn-primary">
                        Изучить главу
                    </a>
                    ${chapter.chapter_test && chapter.chapter_test.num_questions > 0 ? `
                        <a href="test.html?chapter=${encodeURIComponent(chapter.id)}" class="btn btn-secondary">
                            ${testResult ? 'Пересдать тест' : 'Начать тест'}
                        </a>
                    ` : ''}
                </div>
            `;
            
            chaptersList.appendChild(chapterCard);
        }
        
        sectionDiv.appendChild(chaptersList);
        container.appendChild(sectionDiv);
    }
}
