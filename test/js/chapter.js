/**
 * Страница главы - отображение теории и квизов
 */

import { loadChapter, getQuestionsByIds } from './data-loader.js';
import { renderMarkdown } from './markdown-renderer.js';
import { renderQuestion } from './quiz-renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const chapterId = params.get('chapter');
    
    if (!chapterId) {
        alert('Глава не указана');
        window.location.href = 'index.html';
        return;
    }
    
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('chapter-content');
    const headerEl = document.getElementById('chapter-header');
    const blocksEl = document.getElementById('chapter-blocks');
    const breadcrumbEl = document.getElementById('breadcrumb-chapter');
    const testBtn = document.getElementById('start-test-btn');
    
    try {
        // Загружаем главу
        const chapter = await loadChapter(chapterId);
        
        // Обновляем breadcrumb
        breadcrumbEl.textContent = chapter.title || chapter.title_short || chapter.id;
        
        // Рендерим заголовок главы
        renderChapterHeader(chapter, headerEl);
        
        // Рендерим блоки (теория + квизы)
        renderChapterBlocks(chapter, blocksEl);
        
        // Показываем кнопку финального теста
        if (chapter.chapter_test && chapter.chapter_test.num_questions > 0) {
            testBtn.href = `test.html?chapter=${encodeURIComponent(chapterId)}`;
            testBtn.style.display = 'block';
        }
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки главы:', error);
        loadingEl.textContent = 'Ошибка загрузки главы. Проверьте консоль для деталей.';
    }
});

/**
 * Рендерит заголовок главы
 */
function renderChapterHeader(chapter, container) {
    const level = chapter.level ? `<span class="level-badge level-${chapter.level.toLowerCase()}">${chapter.level}</span>` : '';
    const minutes = chapter.estimated_minutes ? `<span class="minutes">~${chapter.estimated_minutes} минут</span>` : '';
    
    container.innerHTML = `
        <div class="chapter-title-section">
            <h1>${chapter.title || chapter.title_short || chapter.id}</h1>
            <div class="chapter-meta">
                ${level} ${minutes}
            </div>
        </div>
        ${chapter.description ? `<div class="chapter-description">${chapter.description}</div>` : ''}
        ${chapter.learning_objectives && chapter.learning_objectives.length > 0 ? `
            <div class="learning-objectives">
                <h3>Цели обучения:</h3>
                <ul>
                    ${chapter.learning_objectives.map(obj => `<li>${obj}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
}

/**
 * Рендерит блоки главы (теория + квизы)
 */
function renderChapterBlocks(chapter, container) {
    container.innerHTML = '';
    
    const blocks = chapter.blocks || [];
    
    for (const block of blocks) {
        if (block.type === 'theory') {
            renderTheoryBlock(block, container, chapter);
        } else if (block.type === 'quiz_inline') {
            renderInlineQuiz(block, container, chapter);
        }
    }
}

/**
 * Рендерит блок теории
 */
function renderTheoryBlock(block, container, chapter) {
    const blockDiv = document.createElement('div');
    blockDiv.className = 'theory-block';
    blockDiv.id = block.id;
    
    const title = block.title ? `<h2 class="block-title">${block.title}</h2>` : '';
    const content = block.theory.content_md 
        ? `<div class="theory-content">${renderMarkdown(block.theory.content_md)}</div>` 
        : '';
    
    // Примеры
    let examplesHtml = '';
    if (block.theory.examples && block.theory.examples.length > 0) {
        examplesHtml = '<div class="theory-examples"><h3>Примеры:</h3><ul>';
        for (const example of block.theory.examples) {
            examplesHtml += `<li>
                <div class="example-text">${example.text}</div>
                ${example.translation ? `<div class="example-translation">${example.translation}</div>` : ''}
                ${example.notes ? `<div class="example-notes">${example.notes}</div>` : ''}
            </li>`;
        }
        examplesHtml += '</ul></div>';
    }
    
    // Ключевые моменты
    let keyPointsHtml = '';
    if (block.theory.key_points && block.theory.key_points.length > 0) {
        keyPointsHtml = '<div class="theory-key-points"><h3>Ключевые моменты:</h3><ul>';
        for (const point of block.theory.key_points) {
            keyPointsHtml += `<li>${point}</li>`;
        }
        keyPointsHtml += '</ul></div>';
    }
    
    // Типичные ошибки
    let mistakesHtml = '';
    if (block.theory.common_mistakes && block.theory.common_mistakes.length > 0) {
        mistakesHtml = '<div class="theory-mistakes"><h3>Типичные ошибки:</h3><ul>';
        for (const mistake of block.theory.common_mistakes) {
            mistakesHtml += `<li>
                <div class="mistake-wrong"><strong>Неправильно:</strong> ${mistake.wrong}</div>
                <div class="mistake-right"><strong>Правильно:</strong> ${mistake.right}</div>
                ${mistake.why ? `<div class="mistake-why">${mistake.why}</div>` : ''}
            </li>`;
        }
        mistakesHtml += '</ul></div>';
    }
    
    blockDiv.innerHTML = title + content + examplesHtml + keyPointsHtml + mistakesHtml;
    container.appendChild(blockDiv);
}

/**
 * Рендерит inline квиз
 */
function renderInlineQuiz(block, container, chapter) {
    const quizDiv = document.createElement('div');
    quizDiv.className = 'inline-quiz';
    quizDiv.id = block.id;
    
    const title = block.title ? `<h2 class="quiz-title">${block.title}</h2>` : '';
    
    const questions = getQuestionsByIds(chapter, block.quiz_inline.question_ids || []);
    
    const questionsContainer = document.createElement('div');
    questionsContainer.className = 'quiz-questions';
    
    // Хранилище ответов пользователя для этого квиза
    const userAnswers = {};
    
    // Callback для сохранения ответов
    const onAnswer = (questionId, answer) => {
        userAnswers[questionId] = answer;
    };
    
    for (const question of questions) {
        // Если show_answers_immediately = true, проверяем сразу после ответа
        // Если false, не показываем ответы до явной проверки
        const checkImmediately = block.quiz_inline.show_answers_immediately || false;
        // ВСЕГДА показываем ответы только после выбора пользователя
        const showAnswersInitially = false;
        
        const questionEl = renderQuestion(
            question, 
            showAnswersInitially, 
            onAnswer, 
            checkImmediately
        );
        questionsContainer.appendChild(questionEl);
    }
    
    quizDiv.innerHTML = title;
    quizDiv.appendChild(questionsContainer);
    container.appendChild(quizDiv);
}
