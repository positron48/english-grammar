// Загрузка данных главы
let chapterData = {};

async function loadChapter() {
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('id');
    
    if (!chapterId) {
        document.getElementById('chapterTitle').textContent = 'Ошибка: ID главы не указан';
        return;
    }

    // Путь относительно корня проекта (сервер запущен из корня)
    // Используем абсолютные пути от корня сервера
    const basePath = `/chapters/${chapterId}/`;
    
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
    
    if (questions.length === 0) {
        document.getElementById('questionsContent').innerHTML = '<p>Вопросы не найдены</p>';
        return;
    }

    let html = `<div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
        <strong>Всего вопросов:</strong> ${questions.length}
    </div>`;

    html += questions.map(q => {
        const typeLabels = {
            'mcq_single': 'Один ответ',
            'mcq_multi': 'Множественный выбор',
            'fill_blank': 'Заполнить пропуск',
            'reorder': 'Переставить',
            'error_spotting': 'Найти ошибку',
            'true_false': 'Верно/Неверно'
        };

        return `
            <div class="question-item">
                <div class="question-header">
                    <div>
                        <span class="question-type">${typeLabels[q.type] || q.type}</span>
                        <span style="margin-left: 10px; font-size: 12px; color: #7f8c8d;">
                            Сложность: ${'⭐'.repeat(q.difficulty || 1)}
                        </span>
                    </div>
                    <div class="question-id">${q.id}</div>
                </div>
                <div class="question-prompt">${formatMarkdown(q.prompt || '')}</div>
                ${q.choices && q.choices.length > 0 ? `
                    <div class="question-choices">
                        ${q.choices.map(choice => {
                            const isCorrect = Array.isArray(q.correct_answer) 
                                ? q.correct_answer.includes(choice.id)
                                : q.correct_answer === choice.id;
                            return `
                                <div class="choice-item ${isCorrect ? 'correct' : ''}">
                                    <span class="choice-id">${choice.id}.</span>
                                    <span>${choice.text}</span>
                                    ${choice.feedback ? `<div class="choice-feedback">${choice.feedback}</div>` : ''}
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
                    <div class="question-explanation">
                        <strong>Объяснение:</strong> ${q.explanation}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('questionsContent').innerHTML = html;
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

// Загрузка при старте
loadChapter();
