// Загрузка данных главы
let chapterData = {};
let chaptersIndex = null;

const VERIFIED_STORAGE_KEY = 'admin-chapters-verified';

function getVerifiedChapters() {
    try {
        const raw = localStorage.getItem(VERIFIED_STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        return (typeof data === 'object' && data !== null) ? data : {};
    } catch (e) {
        return {};
    }
}

function setChapterVerified(id, value) {
    const d = getVerifiedChapters();
    if (value) {
        d[id] = true;
    } else {
        delete d[id];
    }
    localStorage.setItem(VERIFIED_STORAGE_KEY, JSON.stringify(d));
}

function isChapterVerified(id) {
    return !!getVerifiedChapters()[id];
}

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
            chaptersIndex = await indexResponse.json();
            const chapterInfo = chaptersIndex.chapters.find(c => c.id === chapterId);
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
        // 04-inline-quizzes.json больше не используется - квизы генерируются автоматически
        const [outline, questions, final, validation] = await Promise.all([
            fetch(`${basePath}01-outline.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}03-questions.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}05-final.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${basePath}05-validation.json`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        chapterData = {
            id: chapterId,
            outline,
            questions,
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
    const chapterInfo = chaptersIndex?.chapters?.find(c => c.id === chapterData.id);
    const chapterNum = chapterInfo?.path?.match(/\/chapters\/(\d+)\./)?.[1];
    if (chapterNum) meta.push(`№ ${chapterNum}`);
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
    renderChapterPrevNext();
    renderChapterVerified();
}

function renderChapterVerified() {
    const ids = ['chapterVerifiedWrap', 'chapterVerifiedWrapBottom'];
    if (!chapterData.id) return;

    const verified = isChapterVerified(chapterData.id);
    const btnHtml = verified
        ? '<button type="button" class="verified-badge verified-yes verified-toggle-btn" title="Нажмите, чтобы снять отметку">✓ Проверено</button>'
        : '<button type="button" class="verified-badge verified-no verified-toggle-btn">Отметить проверенной</button>';

    const handler = () => {
        setChapterVerified(chapterData.id, !isChapterVerified(chapterData.id));
        renderChapterVerified();
    };

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = btnHtml;
        el.querySelector('.verified-toggle-btn')?.addEventListener('click', handler);
    });
}

function renderChapterPrevNext() {
    const topEl = document.getElementById('chapterPrevNextTop');
    const bottomEl = document.getElementById('chapterPrevNextBottom');
    if (!topEl || !bottomEl) return;

    let prevBtn = '<span class="prev-next-btn prev-next-disabled">← Предыдущая глава</span>';
    let nextBtn = '<span class="prev-next-btn prev-next-disabled">Следующая глава →</span>';

    if (chaptersIndex && Array.isArray(chaptersIndex.chapters)) {
        const extractOrder = (path) => {
            const m = (path || '').match(/\/chapters\/(\d+)\./);
            return m ? parseInt(m[1], 10) : 0;
        };
        const ordered = [...chaptersIndex.chapters].sort((a, b) => extractOrder(a.path) - extractOrder(b.path));
        const idx = ordered.findIndex(c => c.id === chapterData.id);

        if (idx > 0) {
            const prev = ordered[idx - 1];
            prevBtn = `<a href="chapter.html?id=${encodeURIComponent(prev.id)}" class="prev-next-btn prev-next-prev">← Предыдущая глава</a>`;
        }
        if (idx >= 0 && idx < ordered.length - 1) {
            const next = ordered[idx + 1];
            nextBtn = `<a href="chapter.html?id=${encodeURIComponent(next.id)}" class="prev-next-btn prev-next-next">Следующая глава →</a>`;
        }
    }

    const html = `${prevBtn}${nextBtn}`;
    topEl.innerHTML = html;
    bottomEl.innerHTML = html;
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

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

    // Экранируем ID вопроса для безопасного использования в атрибутах
    const safeQuestionId = escapeHtml(q.id);
    const safeTheoryBlockId = q.theory_block_id ? escapeHtml(q.theory_block_id) : '';

    return `
        <div class="question-item" data-question-id="${safeQuestionId}" style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #2196F3;">
            <div class="question-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <span class="question-type" style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        ${typeLabels[q.type] || escapeHtml(q.type || '')}
                    </span>
                    <span style="margin-left: 10px; font-size: 12px; color: #7f8c8d;">
                        Сложность: ${'⭐'.repeat(q.difficulty || 1)}
                    </span>
                    ${q.theory_block_id ? `
                        <span style="margin-left: 10px; font-size: 11px; color: #666; background: #e3f2fd; padding: 2px 6px; border-radius: 3px;">
                            Блок: ${safeTheoryBlockId}
                        </span>
                    ` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="question-id" style="font-size: 12px; color: #666;">ID: ${safeQuestionId}</span>
                    <button onclick="deleteQuestion('${safeQuestionId.replace(/'/g, "\\'")}')" 
                            style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                            title="Удалить вопрос">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
            <div class="question-prompt editable-text" 
                 data-question-id="${safeQuestionId}" 
                 data-field="prompt"
                 style="margin-bottom: 10px; font-weight: 500; padding: 8px; border: 2px dashed transparent; border-radius: 4px; cursor: pointer; min-height: 20px;"
                 onmouseover="this.style.borderColor='#2196F3'; this.style.background='#f5f5f5';"
                 onmouseout="if(!this.querySelector('textarea')) { this.style.borderColor='transparent'; this.style.background='transparent'; }"
                 onclick="startEditQuestionText(event, '${safeQuestionId.replace(/'/g, "\\'")}', 'prompt')"
                 title="Кликните для редактирования текста вопроса">
                ${formatMarkdown(q.prompt || '')}
            </div>
            ${Array.isArray(q.choices) && q.choices.length > 0 ? `
                <div class="question-choices" style="margin-top: 10px;">
                    ${q.choices.map((choice, idx) => {
                        const isCorrect = Array.isArray(q.correct_answer) 
                            ? q.correct_answer.includes(choice.id)
                            : q.correct_answer === choice.id;
                        const choiceText = escapeHtml(choice.text || '');
                        const safeChoiceId = escapeHtml(choice.id || '');
                        const safeChoiceIdForAttr = (choice.id || '').replace(/'/g, "\\'");
                        return `
                            <div class="choice-item ${isCorrect ? 'correct' : ''}" 
                                 style="padding: 8px; margin: 5px 0; background: ${isCorrect ? '#e8f5e9' : '#f5f5f5'}; border-radius: 4px; border-left: 3px solid ${isCorrect ? '#4caf50' : '#ccc'};">
                                <span class="choice-id" style="font-weight: bold; margin-right: 8px;">${safeChoiceId}.</span>
                                <span class="editable-choice-text" 
                                      data-question-id="${safeQuestionId}" 
                                      data-choice-id="${safeChoiceId}"
                                      data-choice-index="${idx}"
                                      data-field="choice"
                                      style="padding: 4px; border: 2px dashed transparent; border-radius: 4px; cursor: pointer; display: inline-block; min-width: 100px;"
                                      onmouseover="this.style.borderColor='#2196F3'; this.style.background='rgba(33, 150, 243, 0.1)';"
                                      onmouseout="if(!this.querySelector('textarea')) { this.style.borderColor='transparent'; this.style.background='transparent'; }"
                                      onclick="startEditChoiceText(event, '${safeQuestionId.replace(/'/g, "\\'")}', '${safeChoiceIdForAttr}', ${idx})"
                                      title="Кликните для редактирования варианта ответа">
                                    ${choiceText}
                                </span>
                                ${choice.feedback ? `<div class="choice-feedback" style="margin-top: 5px; font-size: 12px; color: #666; font-style: italic;">${escapeHtml(choice.feedback)}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            ${q.correct_answer !== undefined && q.correct_answer !== null ? `
                <div style="margin-top: 10px; padding: 10px; background: #e8f5e9; border-radius: 6px;">
                    <strong>Правильный ответ:</strong> 
                    <span class="editable-correct-answer" 
                          data-question-id="${safeQuestionId}" 
                          data-field="correct_answer"
                          style="padding: 4px 8px; border: 2px dashed transparent; border-radius: 4px; cursor: pointer; display: inline-block; margin-left: 8px; min-width: 50px;"
                          onmouseover="this.style.borderColor='#4caf50'; this.style.background='rgba(76, 175, 80, 0.1)';"
                          onmouseout="if(!this.querySelector('textarea')) { this.style.borderColor='transparent'; this.style.background='transparent'; }"
                          onclick="startEditCorrectAnswer(event, '${safeQuestionId.replace(/'/g, "\\'")}')"
                          title="Кликните для редактирования правильного ответа">
                        ${Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : escapeHtml(String(q.correct_answer))}
                    </span>
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
    const final = chapterData.final;
    
    // Квизы теперь генерируются автоматически из final.blocks
    const inlineQuizzes = final?.blocks?.filter(b => b.type === 'quiz_inline') || [];
    
    if (inlineQuizzes.length === 0) {
        document.getElementById('quizzesContent').innerHTML = '<p>Инлайн-квизы не найдены (генерируются автоматически из первых 2 вопросов каждого theory блока)</p>';
        return;
    }

    const allQuizzes = inlineQuizzes.map(q => ({
        block_id: q.id,
        title: q.title,
        question_ids: q.quiz_inline?.question_ids || [],
        show_answers_immediately: q.quiz_inline?.show_answers_immediately
    }));

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
    // 04-inline-quizzes.json больше не используется - квизы генерируются автоматически

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
        questions: questionsData
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
            // Показываем уведомление об успехе в правом нижнем углу
            showNotification('✓ Сохранено', 'success', 2500);
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
function showNotification(message, type = 'info', duration = 3000) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
        animation: slideInFromBottom 0.3s ease-out;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    
    // Добавляем стили анимации если их еще нет
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInFromBottom {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutToBottom {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через указанное время
    setTimeout(() => {
        notification.style.animation = 'slideOutToBottom 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Редактирование текста вопроса
window.startEditQuestionText = function(event, questionId, field) {
    event.stopPropagation();
    const element = event.target.closest('.editable-text');
    if (!element) return;
    
    // Проверяем, не редактируется ли уже
    if (element.querySelector('textarea')) return;
    
    const currentText = getQuestionField(questionId, field);
    
    // Создаем textarea для редактирования
    const textarea = document.createElement('textarea');
    textarea.value = currentText || '';
    textarea.style.cssText = `
        width: 100%;
        min-height: 60px;
        padding: 8px;
        border: 2px solid #2196F3;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
    `;
    
    // Сохраняем оригинальный контент
    const originalContent = element.innerHTML;
    
    // Заменяем контент на textarea
    element.innerHTML = '';
    element.appendChild(textarea);
    element.style.borderColor = '#2196F3';
    element.style.background = '#fff';
    
    // Фокус и выделение текста
    textarea.focus();
    textarea.select();
    
    // Обработчики для сохранения
    const saveEdit = () => {
        const newText = textarea.value.trim();
        if (newText !== currentText) {
            updateQuestionField(questionId, field, newText);
        } else {
            // Восстанавливаем оригинальный контент если не было изменений
            element.innerHTML = originalContent;
            element.style.borderColor = 'transparent';
            element.style.background = 'transparent';
        }
    };
    
    const cancelEdit = () => {
        element.innerHTML = originalContent;
        element.style.borderColor = 'transparent';
        element.style.background = 'transparent';
    };
    
    // Сохранение по Enter (Ctrl+Enter) или Escape для отмены
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveEdit();
        }
    });
    
    // Сохранение при потере фокуса
    textarea.addEventListener('blur', () => {
        setTimeout(saveEdit, 200); // Небольшая задержка для обработки клика на кнопку сохранения
    });
    
    // Останавливаем всплытие события
    textarea.addEventListener('click', (e) => e.stopPropagation());
};

// Редактирование правильного ответа
window.startEditCorrectAnswer = function(event, questionId) {
    event.stopPropagation();
    const element = event.target.closest('.editable-correct-answer');
    if (!element) return;
    
    // Проверяем, не редактируется ли уже
    if (element.querySelector('textarea')) return;
    
    const question = findQuestionById(questionId);
    if (!question) return;
    
    // Получаем текущее значение правильного ответа
    const currentAnswer = question.correct_answer;
    const currentText = Array.isArray(currentAnswer) 
        ? currentAnswer.join(', ') 
        : (currentAnswer !== undefined && currentAnswer !== null ? String(currentAnswer) : '');
    
    // Создаем textarea для редактирования
    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    textarea.style.cssText = `
        width: 100%;
        min-height: 40px;
        padding: 4px 8px;
        border: 2px solid #4caf50;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        display: block;
        margin-top: 4px;
    `;
    
    // Добавляем подсказку в зависимости от типа вопроса
    const questionType = question.type;
    let hint = '';
    if (questionType === 'mcq_multi') {
        hint = ' (для множественного выбора введите ID через запятую, например: a, b, c)';
    } else if (questionType === 'mcq_single') {
        hint = ' (введите ID одного из вариантов, например: a)';
    } else if (questionType === 'true_false') {
        hint = ' (введите: true или false)';
    }
    
    // Сохраняем оригинальный контент
    const originalContent = element.innerHTML;
    
    // Создаем контейнер для textarea и подсказки
    const container = document.createElement('div');
    container.style.cssText = 'width: 100%;';
    
    container.appendChild(textarea);
    if (hint) {
        const hintEl = document.createElement('div');
        hintEl.textContent = hint;
        hintEl.style.cssText = 'font-size: 11px; color: #666; margin-top: 4px; font-style: italic;';
        container.appendChild(hintEl);
    }
    
    // Заменяем контент на textarea
    element.innerHTML = '';
    element.appendChild(container);
    element.style.borderColor = '#4caf50';
    element.style.background = 'rgba(76, 175, 80, 0.1)';
    element.style.display = 'block';
    element.style.width = '100%';
    
    // Фокус и выделение текста
    textarea.focus();
    textarea.select();
    
    // Обработчики для сохранения
    const saveEdit = () => {
        const newText = textarea.value.trim();
        let newValue;
        
        // Парсим значение в зависимости от типа вопроса
        if (questionType === 'mcq_multi') {
            // Для множественного выбора - массив
            newValue = newText ? newText.split(',').map(s => s.trim()).filter(s => s) : [];
        } else {
            // Для остальных типов - строка
            newValue = newText;
        }
        
        // Проверяем, изменилось ли значение
        const currentValueStr = Array.isArray(currentAnswer) 
            ? currentAnswer.join(', ') 
            : (currentAnswer !== undefined && currentAnswer !== null ? String(currentAnswer) : '');
        
        if (newText !== currentValueStr) {
            updateCorrectAnswer(questionId, newValue);
        } else {
            // Восстанавливаем оригинальный контент если не было изменений
            element.innerHTML = originalContent;
            element.style.borderColor = 'transparent';
            element.style.background = 'transparent';
            element.style.display = 'inline-block';
            element.style.width = 'auto';
        }
    };
    
    const cancelEdit = () => {
        element.innerHTML = originalContent;
        element.style.borderColor = 'transparent';
        element.style.background = 'transparent';
        element.style.display = 'inline-block';
        element.style.width = 'auto';
    };
    
    // Сохранение по Enter (Ctrl+Enter) или Escape для отмены
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveEdit();
        }
    });
    
    // Сохранение при потере фокуса
    textarea.addEventListener('blur', () => {
        setTimeout(saveEdit, 200);
    });
    
    // Останавливаем всплытие события
    textarea.addEventListener('click', (e) => e.stopPropagation());
    container.addEventListener('click', (e) => e.stopPropagation());
};

// Редактирование варианта ответа
window.startEditChoiceText = function(event, questionId, choiceId, choiceIndex) {
    event.stopPropagation();
    const element = event.target.closest('.editable-choice-text');
    if (!element) return;
    
    // Проверяем, не редактируется ли уже
    if (element.querySelector('textarea')) return;
    
    const question = findQuestionById(questionId);
    if (!question || !Array.isArray(question.choices)) return;
    
    const choice = question.choices[choiceIndex];
    if (!choice || choice.id !== choiceId) return;
    
    const currentText = choice.text || '';
    
    // Создаем textarea для редактирования
    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    textarea.style.cssText = `
        width: 100%;
        min-height: 40px;
        padding: 4px;
        border: 2px solid #2196F3;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
    `;
    
    // Сохраняем оригинальный контент
    const originalContent = element.innerHTML;
    
    // Заменяем контент на textarea
    element.innerHTML = '';
    element.appendChild(textarea);
    element.style.borderColor = '#2196F3';
    element.style.background = 'rgba(33, 150, 243, 0.1)';
    
    // Фокус и выделение текста
    textarea.focus();
    textarea.select();
    
    // Обработчики для сохранения
    const saveEdit = () => {
        const newText = textarea.value.trim();
        if (newText !== currentText) {
            updateChoiceText(questionId, choiceId, choiceIndex, newText);
        } else {
            // Восстанавливаем оригинальный контент если не было изменений
            element.innerHTML = originalContent;
            element.style.borderColor = 'transparent';
            element.style.background = 'transparent';
        }
    };
    
    const cancelEdit = () => {
        element.innerHTML = originalContent;
        element.style.borderColor = 'transparent';
        element.style.background = 'transparent';
    };
    
    // Сохранение по Enter (Ctrl+Enter) или Escape для отмены
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveEdit();
        }
    });
    
    // Сохранение при потере фокуса
    textarea.addEventListener('blur', () => {
        setTimeout(saveEdit, 200);
    });
    
    // Останавливаем всплытие события
    textarea.addEventListener('click', (e) => e.stopPropagation());
};

// Вспомогательные функции для работы с вопросами
function findQuestionById(questionId) {
    const questions = chapterData.questions?.questions || chapterData.final?.question_bank?.questions || [];
    return questions.find(q => q.id === questionId);
}

function getQuestionField(questionId, field) {
    const question = findQuestionById(questionId);
    if (!question) return '';
    return question[field] || '';
}

function updateQuestionField(questionId, field, newValue) {
    // Обновляем в questions
    if (chapterData.questions && Array.isArray(chapterData.questions.questions)) {
        const question = chapterData.questions.questions.find(q => q.id === questionId);
        if (question) {
            question[field] = newValue;
        }
    }
    
    // Обновляем в final.question_bank.questions
    if (chapterData.final && chapterData.final.question_bank && Array.isArray(chapterData.final.question_bank.questions)) {
        const question = chapterData.final.question_bank.questions.find(q => q.id === questionId);
        if (question) {
            question[field] = newValue;
        }
    }
    
    // Сохраняем изменения
    saveQuestionChanges(questionId);
}

function updateChoiceText(questionId, choiceId, choiceIndex, newText) {
    // Обновляем в questions
    if (chapterData.questions && Array.isArray(chapterData.questions.questions)) {
        const question = chapterData.questions.questions.find(q => q.id === questionId);
        if (question && Array.isArray(question.choices) && question.choices[choiceIndex]) {
            if (question.choices[choiceIndex].id === choiceId) {
                question.choices[choiceIndex].text = newText;
            }
        }
    }
    
    // Обновляем в final.question_bank.questions
    if (chapterData.final && chapterData.final.question_bank && Array.isArray(chapterData.final.question_bank.questions)) {
        const question = chapterData.final.question_bank.questions.find(q => q.id === questionId);
        if (question && Array.isArray(question.choices) && question.choices[choiceIndex]) {
            if (question.choices[choiceIndex].id === choiceId) {
                question.choices[choiceIndex].text = newText;
            }
        }
    }
    
    // Сохраняем изменения
    saveQuestionChanges(questionId);
}

function updateCorrectAnswer(questionId, newValue) {
    // Обновляем в questions
    if (chapterData.questions && Array.isArray(chapterData.questions.questions)) {
        const question = chapterData.questions.questions.find(q => q.id === questionId);
        if (question) {
            question.correct_answer = newValue;
        }
    }
    
    // Обновляем в final.question_bank.questions
    if (chapterData.final && chapterData.final.question_bank && Array.isArray(chapterData.final.question_bank.questions)) {
        const question = chapterData.final.question_bank.questions.find(q => q.id === questionId);
        if (question) {
            question.correct_answer = newValue;
        }
    }
    
    // Сохраняем изменения
    saveQuestionChanges(questionId);
}

// Сохранение изменений вопроса
async function saveQuestionChanges(questionId) {
    try {
        // Используем существующую функцию updateChapterFiles для сохранения
        // Она сама покажет уведомление об успехе или ошибке
        await updateChapterFiles();
        // После успешного сохранения перерисовываем вопросы
        renderQuestions();
    } catch (error) {
        console.error('Ошибка при сохранении изменений:', error);
        // updateChapterFiles уже показал уведомление об ошибке, но на всякий случай показываем еще раз
    }
}

// Удаление вопроса (глобальная функция для доступа из HTML)
window.deleteQuestion = function(questionId) {
    if (!confirm(`Вы уверены, что хотите удалить вопрос "${questionId}"?\n\nВопрос будет удален из:\n- 03-questions.json\n- 05-final.json (если доступен)\n\nInline-квизы генерируются автоматически, поэтому будут обновлены при следующей пересборке.\n\nФайлы будут обновлены автоматически на сервере.`)) {
        return;
    }

    // Удаляем вопрос из массива вопросов
    if (chapterData.questions && Array.isArray(chapterData.questions.questions)) {
        chapterData.questions.questions = chapterData.questions.questions.filter(q => q.id !== questionId);
    }
    if (chapterData.final && chapterData.final.question_bank && Array.isArray(chapterData.final.question_bank.questions)) {
        chapterData.final.question_bank.questions = chapterData.final.question_bank.questions.filter(q => q.id !== questionId);
    }

    // Inline-квизы генерируются автоматически, поэтому при пересборке они обновятся автоматически
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
