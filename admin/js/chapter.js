// Загрузка данных главы
let chapterData = {};

async function loadChapter() {
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('id');
    
    if (!chapterId) {
        document.getElementById('chapterTitle').textContent = 'Ошибка: ID главы не указан';
        return;
    }

    // Получаем реальное имя папки (может быть с префиксом)
    // Пытаемся найти папку с префиксом через индекс
    let basePath = `/chapters/${chapterId}/`;
    
    try {
        const indexResponse = await fetch('/admin/data/chapters-index.json');
        if (indexResponse.ok) {
            const index = await indexResponse.json();
            const chapterInfo = index.chapters.find(c => c.id === chapterId);
            if (chapterInfo && chapterInfo.path) {
                // Путь в индексе может быть относительным (chapters/...) или абсолютным (/chapters/...)
                // Преобразуем в абсолютный путь и убеждаемся, что он заканчивается на /
                basePath = chapterInfo.path.startsWith('/') ? chapterInfo.path : '/' + chapterInfo.path;
                if (!basePath.endsWith('/')) {
                    basePath += '/';
                }
            }
        }
    } catch (e) {
        console.warn('Не удалось загрузить индекс для определения пути:', e);
    }
    
    try {
        // Загружаем все файлы главы
        const [outline, questions, quizzes, final, validation] = await Promise.all([
            fetch(`${basePath}01-outline.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}03-questions.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}04-inline-quizzes.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}05-final.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}05-validation.json`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        chapterData = {
            id: chapterId,
            outline,
            questions,
            quizzes,
            final,
            validation
        };

        // Загружаем блоки теории
        if (final && final.blocks) {
            const theoryBlocks = final.blocks.filter(b => b.type === 'theory');
            chapterData.theoryBlocks = theoryBlocks;
        } else {
            // Пытаемся загрузить из папки theory-blocks
            try {
                const theoryRes = await fetch(`${basePath}02-theory-blocks/`);
                if (theoryRes.ok) {
                    const html = await theoryRes.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const theoryFiles = Array.from(doc.querySelectorAll('a'))
                        .map(a => a.href)
                        .filter(href => href.endsWith('.json'))
                        .map(href => href.split('/').pop());

                    chapterData.theoryBlocks = [];
                    for (const file of theoryFiles) {
                        try {
                            const blockRes = await fetch(`${basePath}02-theory-blocks/${file}`);
                            if (blockRes.ok) {
                                const block = await blockRes.json();
                                chapterData.theoryBlocks.push(block.theory_block || block);
                            }
                        } catch (e) {
                            console.warn(`Не удалось загрузить блок ${file}`);
                        }
                    }
                }
            } catch (e) {
                console.warn('Не удалось загрузить блоки теории');
            }
        }

        renderChapter();
    } catch (error) {
        console.error('Ошибка загрузки главы:', error);
        document.getElementById('chapterTitle').textContent = `Ошибка: ${error.message}`;
    }
}

function renderChapter() {
    const final = chapterData.final;
    const title = final?.title || chapterData.outline?.chapter_outline?.title || chapterData.id;
    
    document.getElementById('chapterTitle').textContent = title;
    
    // Мета-информация
    const meta = [];
    if (final?.level) meta.push(`Уровень: ${final.level}`);
    if (final?.order !== undefined) meta.push(`Порядок: ${final.order}`);
    if (final?.estimated_minutes) meta.push(`Время: ${final.estimated_minutes} мин`);
    if (final?.ui_language) meta.push(`Язык UI: ${final.ui_language}`);
    if (final?.target_language) meta.push(`Целевой язык: ${final.target_language}`);
    
    document.getElementById('chapterMeta').innerHTML = meta.map(m => `<span>${m}</span>`).join(' • ');

    renderOverview();
    renderOutline();
    renderTheory();
    renderQuestions();
    renderQuizzes();
    renderFinal();
    renderValidation();
}

function renderOverview() {
    const final = chapterData.final;
    const outline = chapterData.outline?.chapter_outline || chapterData.outline;
    
    let html = '<div class="overview-grid">';
    
    if (final) {
        html += `
            <div class="overview-section">
                <h3>Основная информация</h3>
                <p><strong>ID:</strong> <code>${final.id || chapterData.id}</code></p>
                <p><strong>Раздел:</strong> ${final.section_id || 'Не указан'}</p>
                <p><strong>Название:</strong> ${final.title || 'Не указано'}</p>
                ${final.title_short ? `<p><strong>Короткое название:</strong> ${final.title_short}</p>` : ''}
                ${final.description ? `<p><strong>Описание:</strong> ${final.description}</p>` : ''}
            </div>
        `;

        if (final.learning_objectives && final.learning_objectives.length > 0) {
            html += `
                <div class="overview-section">
                    <h3>Цели обучения</h3>
                    <ul>
                        ${final.learning_objectives.map(obj => `<li>${obj}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (final.prerequisites && final.prerequisites.length > 0) {
            html += `
                <div class="overview-section">
                    <h3>Предварительные требования</h3>
                    <ul>
                        ${final.prerequisites.map(pr => `<li><code>${pr}</code></li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += `
            <div class="overview-section">
                <h3>Статистика</h3>
                <p><strong>Блоков теории:</strong> ${(final.blocks || []).filter(b => b.type === 'theory').length}</p>
                <p><strong>Инлайн-квизов:</strong> ${(final.blocks || []).filter(b => b.type === 'quiz_inline').length}</p>
                <p><strong>Вопросов в банке:</strong> ${final.question_bank?.questions?.length || 0}</p>
                <p><strong>Вопросов в тесте:</strong> ${final.chapter_test?.num_questions || 0}</p>
            </div>
        `;
    }
    
    html += '</div>';
    document.getElementById('overviewContent').innerHTML = html;
}

function renderOutline() {
    const outline = chapterData.outline?.chapter_outline || chapterData.outline;
    
    if (!outline) {
        document.getElementById('outlineContent').innerHTML = '<p>План главы не найден</p>';
        return;
    }

    let html = '<div class="json-viewer">';
    html += formatJSON(outline);
    html += '</div>';
    
    document.getElementById('outlineContent').innerHTML = html;
}

function renderTheory() {
    const blocks = chapterData.theoryBlocks || [];
    
    if (blocks.length === 0) {
        document.getElementById('theoryContent').innerHTML = '<p>Блоки теории не найдены</p>';
        return;
    }

    let html = blocks.map(block => {
        const theory = block.theory || block;
        const id = theory.id || block.id;
        const title = theory.title || block.title || id;
        
        return `
            <div class="theory-block">
                <div class="theory-block-header">
                    <div class="theory-block-title">${title}</div>
                    <div class="theory-block-id">${id}</div>
                </div>
                ${theory.content_md ? `
                    <div class="theory-content">
                        <div class="markdown-content">${formatMarkdown(theory.content_md)}</div>
                    </div>
                ` : ''}
                ${theory.key_points && theory.key_points.length > 0 ? `
                    <div class="key-points">
                        <h4>Ключевые моменты:</h4>
                        <ul>
                            ${theory.key_points.map(kp => `<li>${kp}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${theory.common_mistakes && theory.common_mistakes.length > 0 ? `
                    <div class="common-mistakes">
                        <h4>Типичные ошибки:</h4>
                        ${theory.common_mistakes.map(mistake => `
                            <div class="mistake-item">
                                <div class="mistake-wrong">❌ Неправильно: ${mistake.wrong}</div>
                                <div class="mistake-right">✅ Правильно: ${mistake.right}</div>
                                <div style="margin-top: 5px; font-size: 13px;">${mistake.why}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${theory.examples && theory.examples.length > 0 ? `
                    <div class="examples">
                        <h4>Примеры:</h4>
                        ${theory.examples.map(ex => `
                            <div class="example-item">
                                <div class="example-text">${ex.text}</div>
                                <div class="example-translation">${ex.translation}</div>
                                ${ex.notes ? `<div class="example-notes">${ex.notes}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('theoryContent').innerHTML = html;
}

function renderQuestions() {
    const questions = chapterData.questions?.questions || chapterData.final?.question_bank?.questions || [];
    
    if (!Array.isArray(questions) || questions.length === 0) {
        document.getElementById('questionsContent').innerHTML = '<p>Вопросы не найдены</p>';
        return;
    }

    // Создаем мапу блоков теории для получения названий
    const theoryBlocksMap = {};
    if (chapterData.final && Array.isArray(chapterData.final.blocks)) {
        chapterData.final.blocks.forEach(block => {
            if (block.type === 'theory' && block.id) {
                theoryBlocksMap[block.id] = {
                    id: block.id,
                    title: block.title || block.id,
                    theory: block.theory
                };
            }
        });
    }
    if (Array.isArray(chapterData.theoryBlocks)) {
        chapterData.theoryBlocks.forEach(block => {
            const blockId = block.id || block.theory_block?.id;
            if (blockId && !theoryBlocksMap[blockId]) {
                theoryBlocksMap[blockId] = {
                    id: blockId,
                    title: block.title || block.theory_block?.title || blockId,
                    theory: block.theory || block.theory_block
                };
            }
        });
    }

    // Группируем вопросы по theory_block_id
    const questionsByBlock = {};
    const questionsWithoutBlock = [];
    
    questions.forEach(q => {
        const blockId = q.theory_block_id || 'unknown';
        if (blockId === 'unknown' || !theoryBlocksMap[blockId]) {
            questionsWithoutBlock.push(q);
        } else {
            if (!questionsByBlock[blockId]) {
                questionsByBlock[blockId] = [];
            }
            questionsByBlock[blockId].push(q);
        }
    });

    let html = `<div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
        <strong>Всего вопросов:</strong> ${questions.length}
        <span style="margin-left: 20px; font-size: 12px; color: #666;">
            💡 Файлы обновляются автоматически при удалении вопросов
        </span>
    </div>`;

    // Рендерим вопросы по блокам
    const allBlockIds = Object.keys(questionsByBlock).sort();
    
    allBlockIds.forEach(blockId => {
        const blockQuestions = questionsByBlock[blockId];
        const blockInfo = theoryBlocksMap[blockId];
        const blockTitle = blockInfo ? blockInfo.title : blockId;
        
        html += `
            <div class="theory-block-group" style="margin-bottom: 30px; border: 2px solid #2196F3; border-radius: 8px; padding: 15px; background: #f5f5f5;">
                <h3 style="margin-top: 0; color: #1976D2; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">
                    📚 ${blockTitle}
                    <span style="font-size: 14px; font-weight: normal; color: #666; margin-left: 10px;">
                        (ID: ${blockId}, вопросов: ${blockQuestions.length})
                    </span>
                </h3>
                ${blockQuestions.map(q => renderQuestionItem(q)).join('')}
            </div>
        `;
    });

    // Рендерим вопросы без блока
    if (questionsWithoutBlock.length > 0) {
        html += `
            <div class="theory-block-group" style="margin-bottom: 30px; border: 2px solid #ff9800; border-radius: 8px; padding: 15px; background: #fff3e0;">
                <h3 style="margin-top: 0; color: #f57c00; border-bottom: 2px solid #ff9800; padding-bottom: 10px;">
                    ⚠️ Вопросы без привязки к блоку теории
                    <span style="font-size: 14px; font-weight: normal; color: #666; margin-left: 10px;">
                        (вопросов: ${questionsWithoutBlock.length})
                    </span>
                </h3>
                ${questionsWithoutBlock.map(q => renderQuestionItem(q)).join('')}
            </div>
        `;
    }

    document.getElementById('questionsContent').innerHTML = html;
}

function renderQuestionItem(q) {
    const typeLabels = {
        'mcq_single': 'Один ответ',
        'mcq_multi': 'Множественный выбор',
        'fill_blank': 'Заполнить пропуск',
        'reorder': 'Переставить',
        'error_spotting': 'Найти ошибку',
        'true_false': 'Верно/Неверно'
    };

    return `
        <div class="question-item" data-question-id="${q.id}" style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #2196F3;">
            <div class="question-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <span class="question-type" style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        ${typeLabels[q.type] || q.type}
                    </span>
                    <span style="margin-left: 10px; font-size: 12px; color: #7f8c8d;">
                        Сложность: ${'⭐'.repeat(q.difficulty || 1)}
                    </span>
                    ${q.theory_block_id ? `
                        <span style="margin-left: 10px; font-size: 11px; color: #666; background: #e3f2fd; padding: 2px 6px; border-radius: 3px;">
                            Блок: ${q.theory_block_id}
                        </span>
                    ` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="question-id" style="font-size: 12px; color: #666;">ID: ${q.id}</span>
                    <button onclick="deleteQuestion('${q.id}')" 
                            style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                            title="Удалить вопрос">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
            <div class="question-prompt" style="margin-bottom: 10px; font-weight: 500;">
                ${formatMarkdown(q.prompt || '')}
            </div>
            ${Array.isArray(q.choices) && q.choices.length > 0 ? `
                <div class="question-choices" style="margin-top: 10px;">
                    ${q.choices.map(choice => {
                        const isCorrect = Array.isArray(q.correct_answer) 
                            ? q.correct_answer.includes(choice.id)
                            : q.correct_answer === choice.id;
                        return `
                            <div class="choice-item ${isCorrect ? 'correct' : ''}" 
                                 style="padding: 8px; margin: 5px 0; background: ${isCorrect ? '#e8f5e9' : '#f5f5f5'}; border-radius: 4px; border-left: 3px solid ${isCorrect ? '#4caf50' : '#ccc'};">
                                <span class="choice-id" style="font-weight: bold; margin-right: 8px;">${choice.id}.</span>
                                <span>${choice.text}</span>
                                ${choice.feedback ? `<div class="choice-feedback" style="margin-top: 5px; font-size: 12px; color: #666; font-style: italic;">${choice.feedback}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            ${q.correct_answer ? `
                <div style="margin-top: 10px; padding: 10px; background: #e8f5e9; border-radius: 6px;">
                    <strong>Правильный ответ:</strong> 
                    ${Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : q.correct_answer}
                </div>
            ` : ''}
            ${q.explanation ? `
                <div class="question-explanation" style="margin-top: 10px; padding: 10px; background: #fff3e0; border-radius: 6px;">
                    <strong>Объяснение:</strong> ${q.explanation}
                </div>
            ` : ''}
        </div>
    `;
}

function renderQuizzes() {
    const quizzes = chapterData.quizzes?.inline_quizzes || [];
    const final = chapterData.final;
    
    // Также проверяем блоки quiz_inline в final
    const inlineQuizzes = final?.blocks?.filter(b => b.type === 'quiz_inline') || [];
    
    if (quizzes.length === 0 && inlineQuizzes.length === 0) {
        document.getElementById('quizzesContent').innerHTML = '<p>Инлайн-квизы не найдены</p>';
        return;
    }

    const allQuizzes = [...quizzes, ...inlineQuizzes.map(q => ({
        block_id: q.id,
        title: q.title,
        question_ids: q.quiz_inline?.question_ids || [],
        show_answers_immediately: q.quiz_inline?.show_answers_immediately
    }))];

    let html = allQuizzes.map(quiz => {
        return `
            <div class="quiz-item">
                <div class="quiz-header">
                    <div class="quiz-title">${quiz.title || quiz.block_id}</div>
                    <div style="font-size: 12px; color: #7f8c8d;">
                        ${quiz.show_answers_immediately ? '✓ Ответы сразу' : 'Ответы после'}
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <strong>Вопросов:</strong> ${quiz.question_ids?.length || 0}
                </div>
                <div class="quiz-questions">
                    ${(quiz.question_ids || []).map(qId => 
                        `<span class="question-tag">${qId}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('quizzesContent').innerHTML = html;
}

function renderFinal() {
    const final = chapterData.final;
    
    if (!final) {
        document.getElementById('finalContent').innerHTML = '<p>Финальная версия не найдена</p>';
        return;
    }

    let html = '<div class="json-viewer">';
    html += formatJSON(final);
    html += '</div>';
    
    document.getElementById('finalContent').innerHTML = html;
}

function renderValidation() {
    const validation = chapterData.validation;
    
    if (!validation) {
        document.getElementById('validationContent').innerHTML = '<p>Данные валидации не найдены</p>';
        return;
    }

    const result = validation.validation_result || {};
    const isValid = result.is_valid || false;
    
    let html = `
        <div class="validation-result ${isValid ? 'valid' : 'invalid'}">
            <h3>${isValid ? '✓ Глава валидна' : '✗ Глава содержит ошибки'}</h3>
            ${result.schema_valid !== undefined ? `<p><strong>Схема валидна:</strong> ${result.schema_valid ? 'Да' : 'Нет'}</p>` : ''}
        </div>
    `;

    if (result.summary) {
        html += `
            <div class="validation-summary">
                <div class="validation-stat">
                    <div class="validation-stat-value">${result.summary.total_issues || 0}</div>
                    <div class="validation-stat-label">Всего проблем</div>
                </div>
                <div class="validation-stat">
                    <div class="validation-stat-value" style="color: #c62828;">${result.summary.errors || 0}</div>
                    <div class="validation-stat-label">Ошибки</div>
                </div>
                <div class="validation-stat">
                    <div class="validation-stat-value" style="color: #f57c00;">${result.summary.warnings || 0}</div>
                    <div class="validation-stat-label">Предупреждения</div>
                </div>
                <div class="validation-stat">
                    <div class="validation-stat-value" style="color: #1976d2;">${result.summary.suggestions || 0}</div>
                    <div class="validation-stat-label">Предложения</div>
                </div>
            </div>
        `;
    }

    if (result.issues && result.issues.length > 0) {
        html += `
            <div style="margin-top: 20px;">
                <h4>Проблемы:</h4>
                <ul>
                    ${result.issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    if (result.coverage) {
        html += `
            <div class="coverage-info">
                <h4>Покрытие:</h4>
                <div class="coverage-item">
                    <span>Блоков теории покрыто:</span>
                    <strong>${result.coverage.theory_blocks_covered || 0} / ${result.coverage.total_theory_blocks || 0}</strong>
                </div>
                ${result.coverage.questions_per_block ? Object.entries(result.coverage.questions_per_block).map(([block, count]) => `
                    <div class="coverage-item">
                        <span><code>${block}</code>:</span>
                        <strong>${count} вопросов</strong>
                    </div>
                `).join('') : ''}
            </div>
        `;
    }

    html += '<div class="json-viewer" style="margin-top: 20px;">';
    html += formatJSON(validation);
    html += '</div>';

    document.getElementById('validationContent').innerHTML = html;
}

// Навигация по разделам
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Показываем нужный раздел
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');
    });
});

// Утилиты
function formatJSON(obj) {
    return JSON.stringify(obj, null, 2)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
}

function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// Обновление файлов на сервере
async function updateChapterFiles() {
    const chapterId = chapterData.id;
    
    // Подготовка данных для отправки
    const questionsData = chapterData.questions?.questions || chapterData.final?.question_bank?.questions || [];
    const quizzesData = {
        inline_quizzes: chapterData.quizzes?.inline_quizzes || []
    };

    // Обновляем inline_quizzes из final.blocks если нужно
    if (chapterData.final && Array.isArray(chapterData.final.blocks)) {
        const inlineQuizzesFromBlocks = chapterData.final.blocks
            .filter(block => block.type === 'quiz_inline')
            .map(block => ({
                block_id: block.id,
                theory_block_id: block.theory_block_id || null,
                title: block.title || 'Quick check',
                question_ids: block.quiz_inline?.question_ids || [],
                show_answers_immediately: block.quiz_inline?.show_answers_immediately !== undefined 
                    ? block.quiz_inline.show_answers_immediately 
                    : true
            }));
        
        if (inlineQuizzesFromBlocks.length > 0) {
            quizzesData.inline_quizzes = inlineQuizzesFromBlocks;
        }
    }

    // Подготавливаем обновленный final.json (если есть)
    let finalData = null;
    if (chapterData.final) {
        finalData = JSON.parse(JSON.stringify(chapterData.final)); // Глубокая копия
        
        // Обновляем question_bank
        if (finalData.question_bank) {
            finalData.question_bank.questions = questionsData;
        }
        
        // Обновляем chapter_test.pool_question_ids
        if (finalData.chapter_test && Array.isArray(finalData.chapter_test.pool_question_ids)) {
            finalData.chapter_test.pool_question_ids = questionsData.map(q => q.id);
        }
        
        // Обновляем meta.updated_at
        if (finalData.meta) {
            const now = new Date();
            finalData.meta.updated_at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
        }
    }

    // Формируем данные для отправки
    const updateData = {
        chapter_id: chapterId,
        questions: questionsData,
        quizzes: quizzesData
    };
    
    if (finalData) {
        updateData.final = finalData;
    }

    try {
        const response = await fetch('/admin/api/update-chapter-files.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || (errorData.errors && errorData.errors.join(', ')) || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log('✓ Файлы обновлены:', result.updated);
            // Показываем уведомление об успехе
            showNotification(`✓ Файлы успешно обновлены: ${result.updated.join(', ')}`, 'success');
        } else {
            console.error('✗ Ошибка обновления файлов:', result);
            const errorMsg = result.error || (result.errors && result.errors.join(', ')) || 'Неизвестная ошибка';
            showNotification(`✗ Ошибка обновления файлов: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка при отправке запроса:', error);
        showNotification(`✗ Ошибка при отправке запроса: ${error.message}`, 'error');
    }
}

// Показ уведомления
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Добавляем стили анимации если их еще нет
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Удаление вопроса (глобальная функция для доступа из HTML)
window.deleteQuestion = function(questionId) {
    if (!confirm(`Вы уверены, что хотите удалить вопрос "${questionId}"?\n\nВопрос будет удален из:\n- 03-questions.json\n- Всех inline-quizzes (04-inline-quizzes.json)\n- 05-final.json (если доступен)\n\nФайлы будут обновлены автоматически на сервере.`)) {
        return;
    }

    // Удаляем вопрос из массива вопросов
    if (chapterData.questions && Array.isArray(chapterData.questions.questions)) {
        chapterData.questions.questions = chapterData.questions.questions.filter(q => q.id !== questionId);
    }
    if (chapterData.final && chapterData.final.question_bank && Array.isArray(chapterData.final.question_bank.questions)) {
        chapterData.final.question_bank.questions = chapterData.final.question_bank.questions.filter(q => q.id !== questionId);
    }

    // Удаляем ID вопроса из всех inline-quizzes
    if (chapterData.quizzes && Array.isArray(chapterData.quizzes.inline_quizzes)) {
        chapterData.quizzes.inline_quizzes.forEach(quiz => {
            if (Array.isArray(quiz.question_ids)) {
                quiz.question_ids = quiz.question_ids.filter(id => id !== questionId);
            }
        });
    }

    // Удаляем ID вопроса из quiz_inline блоков в final
    if (chapterData.final && Array.isArray(chapterData.final.blocks)) {
        chapterData.final.blocks.forEach(block => {
            if (block.type === 'quiz_inline' && block.quiz_inline && Array.isArray(block.quiz_inline.question_ids)) {
                block.quiz_inline.question_ids = block.quiz_inline.question_ids.filter(id => id !== questionId);
            }
        });
    }

    // Удаляем ID вопроса из chapter_test.pool_question_ids
    if (chapterData.final && chapterData.final.chapter_test && Array.isArray(chapterData.final.chapter_test.pool_question_ids)) {
        chapterData.final.chapter_test.pool_question_ids = chapterData.final.chapter_test.pool_question_ids.filter(id => id !== questionId);
    }

    // Отправляем обновленные данные на сервер
    updateChapterFiles();
    
    // Перерисовываем список вопросов
    renderQuestions();
}

// Загрузка при старте
loadChapter();
