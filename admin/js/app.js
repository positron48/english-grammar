// Загрузка списка всех глав
let allChapters = [];
let filteredChapters = [];
let generationStatus = null; // Кэш для generation-status.json

// Определяем базовый путь относительно текущего URL
function getBasePath() {
    // Если мы уже в /admin/, пути должны быть относительно корня сервера
    // Не добавляем лишний /admin/ к путям
    return '';
}

// Загружает generation-status.json для получения порядка разделов и глав
async function loadGenerationStatus() {
    if (generationStatus) {
        return generationStatus;
    }
    
    try {
        const possiblePaths = [
            '/config/generation-status.json',
            '../config/generation-status.json',
            'config/generation-status.json'
        ];
        
        for (const path of possiblePaths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    generationStatus = await response.json();
                    console.log('✓ generation-status.json загружен:', path);
                    return generationStatus;
                }
            } catch (e) {
                continue;
            }
        }
        
        console.warn('⚠️ Не удалось загрузить generation-status.json');
        return null;
    } catch (error) {
        console.warn('⚠️ Ошибка загрузки generation-status.json:', error);
        return null;
    }
}

async function loadChapters() {
    console.log('Текущий путь:', window.location.pathname);
    console.log('Текущий URL:', window.location.href);
    
    // Убеждаемся, что allChapters и filteredChapters инициализированы
    if (!Array.isArray(allChapters)) {
        allChapters = [];
    }
    if (!Array.isArray(filteredChapters)) {
        filteredChapters = [];
    }
    
    try {
        // Сначала пытаемся загрузить индекс
        let chapterIds = [];
        
        // Пробуем разные пути к индексу
        // Используем абсолютные пути от корня сервера (начинаются с /)
        const possibleIndexPaths = [
            '/admin/data/chapters-index.json',  // Абсолютный путь от корня сервера
            'data/chapters-index.json',         // Относительно текущей директории (/admin/)
            './data/chapters-index.json'        // То же самое, явно
        ];
        
        let indexLoaded = false;
        for (const indexPath of possibleIndexPaths) {
            try {
                console.log(`Попытка загрузить индекс: ${indexPath}`);
                const indexResponse = await fetch(indexPath);
                console.log(`Ответ для ${indexPath}:`, indexResponse.status, indexResponse.statusText);
                
                if (indexResponse.ok) {
                    const index = await indexResponse.json();
                    if (index && Array.isArray(index.chapters)) {
                        chapterIds = index.chapters.map(c => c.id);
                        console.log(`✓ Загружен индекс: ${chapterIds.length} глав из ${indexPath}`);
                        indexLoaded = true;
                        break;
                    }
                }
            } catch (e) {
                console.warn(`Ошибка загрузки ${indexPath}:`, e.message);
            }
        }
        
        if (!indexLoaded) {
            console.warn('Индекс не загружен, пытаемся прочитать директорию chapters/...');
            // Если индекс не найден, пытаемся прочитать директорию
            const possibleChapterPaths = [
                '/chapters/',      // Абсолютный путь от корня
                'chapters/',       // Относительно корня
                '../chapters/'     // На уровень выше от /admin/
            ];
            
            for (const chapterPath of possibleChapterPaths) {
                try {
                    console.log(`Попытка прочитать директорию: ${chapterPath}`);
                    const response = await fetch(chapterPath);
                    console.log(`Ответ от ${chapterPath}:`, response.status, response.statusText);
                    
                    if (response.ok) {
                        const html = await response.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const foundIds = Array.from(doc.querySelectorAll('a'))
                            .map(a => a.href)
                            .filter(href => href.endsWith('/'))
                            .map(href => href.split('/').filter(Boolean).pop())
                            .filter(id => id && !id.includes('.') && id !== 'admin');
                        if (Array.isArray(foundIds)) {
                            chapterIds = foundIds;
                            console.log(`✓ Найдено глав в директории ${chapterPath}: ${chapterIds.length}`);
                        }
                        break; // Успешно загрузили, выходим из цикла
                    }
                } catch (err) {
                    console.warn(`✗ Не удалось прочитать ${chapterPath}:`, err.message);
                }
            }
        }

        if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
            const errorMsg = 'Не найдено ни одной главы. ' +
                'Убедитесь, что:\n' +
                '1. Запущен `make admin` из корня проекта\n' +
                '2. Сервер запущен из корня проекта (не из папки admin)\n' +
                '3. Файл admin/data/chapters-index.json существует\n' +
                '4. Откройте http://localhost:8000/admin/ (не http://localhost:8000)';
            throw new Error(errorMsg);
        }

        // Загружаем generation-status для правильного порядка
        await loadGenerationStatus();
        
        // Инициализируем allChapters как массив
        if (!Array.isArray(allChapters)) {
            allChapters = [];
        }
        
        // Загружаем данные каждой главы
        for (const chapterId of chapterIds) {
            try {
                const chapter = await loadChapterData(chapterId);
                if (chapter) {
                    allChapters.push(chapter);
                    // Логируем проблемы загрузки
                    if (chapter.errors && chapter.errors.length > 0) {
                        console.warn(`Глава ${chapterId} загружена с ошибками:`, chapter.errors);
                    }
                }
            } catch (error) {
                console.error(`Ошибка загрузки главы ${chapterId}:`, error);
                // Добавляем главу даже с ошибкой, чтобы показать что она есть
                allChapters.push({
                    id: chapterId,
                    title: chapterId,
                    errors: [error.message],
                    hasValidation: false
                });
            }
        }

        // Сортируем главы согласно порядку из generation-status.json
        if (generationStatus && Array.isArray(allChapters)) {
            // Создаем мапу chapter_id -> порядковый номер в рамках всего курса
            const chapterOrderMap = {};
            let globalOrder = 0;
            
            // Проходим по разделам в порядке из generation-status
            if (Array.isArray(generationStatus.sections)) {
                for (const section of generationStatus.sections) {
                    // Проходим по главам раздела в порядке из chapter_ids
                    if (Array.isArray(section.chapter_ids)) {
                        for (const chapterId of section.chapter_ids) {
                            chapterOrderMap[chapterId] = globalOrder++;
                        }
                    }
                }
            }
            
            // Сортируем главы по порядку из generation-status
            allChapters.sort((a, b) => {
                const orderA = chapterOrderMap[a.id] !== undefined ? chapterOrderMap[a.id] : 9999;
                const orderB = chapterOrderMap[b.id] !== undefined ? chapterOrderMap[b.id] : 9999;
                return orderA - orderB;
            });
        } else if (Array.isArray(allChapters)) {
            // Fallback: сортируем по order из данных главы
            allChapters.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        
        filteredChapters = Array.isArray(allChapters) ? [...allChapters] : [];
        
        // Показываем отладочную информацию если есть проблемы
        if (!Array.isArray(allChapters)) {
            allChapters = [];
        }
        const chaptersWithErrors = Array.isArray(allChapters) 
            ? allChapters.filter(c => c && c.errors && Array.isArray(c.errors) && c.errors.length > 0)
            : [];
        if ((Array.isArray(chaptersWithErrors) && chaptersWithErrors.length > 0) || 
            (Array.isArray(allChapters) && allChapters.length === 0)) {
            const debugDiv = document.getElementById('debugInfo');
            const debugContent = document.getElementById('debugContent');
            const currentUrlEl = document.getElementById('currentUrl');
            const correctUrlEl = document.getElementById('correctUrl');
            
            if (debugDiv && debugContent) {
                debugDiv.style.display = 'block';
                
                const currentUrl = window.location.href;
                const correctUrl = currentUrl.includes('/admin/') ? currentUrl : currentUrl.replace(/\/$/, '') + '/admin/';
                
                if (currentUrlEl) currentUrlEl.textContent = currentUrl;
                if (correctUrlEl) {
                    correctUrlEl.href = correctUrl;
                    correctUrlEl.textContent = correctUrl;
                }
                
                debugContent.innerHTML = `
                    <p><strong>Проблемы с загрузкой:</strong></p>
                    ${(Array.isArray(allChapters) && allChapters.length === 0) ? '<p style="color: #c62828;">❌ Не загружено ни одной главы!</p>' : ''}
                    ${(Array.isArray(chaptersWithErrors) && chaptersWithErrors.length > 0) ? `
                        <p><strong>Глав с ошибками загрузки:</strong> ${chaptersWithErrors.length}</p>
                        <ul>
                            ${chaptersWithErrors.map(c => {
                                if (c && c.id && Array.isArray(c.errors)) {
                                    return `<li><strong>${c.id}:</strong> ${c.errors.join(', ')}</li>`;
                                }
                                return '';
                            }).filter(s => s).join('')}
                        </ul>
                    ` : ''}
                    <p><strong>Совет:</strong> Откройте консоль браузера (F12) для детальной информации об ошибках.</p>
                    <p><strong>Проверьте:</strong></p>
                    <ul>
                        <li>Сервер запущен из корня проекта (не из папки admin)</li>
                        <li>Открыт правильный URL: http://localhost:8000/admin/</li>
                        <li>Файл admin/data/chapters-index.json существует</li>
                    </ul>
                `;
            }
        }
        
        updateStats();
        renderChapters();
    } catch (error) {
        console.error('Ошибка загрузки глав:', error);
        console.error('Стек ошибки:', error.stack);
        console.error('allChapters:', allChapters);
        console.error('filteredChapters:', filteredChapters);
        console.error('generationStatus:', generationStatus);
        
        const errorMessage = error.message || 'Неизвестная ошибка';
        const errorStack = error.stack || '';
        
        document.getElementById('chaptersList').innerHTML = 
            `<div class="error">
                <strong>Ошибка загрузки глав:</strong> ${errorMessage}<br>
                <details style="margin-top: 10px;">
                    <summary>Детали ошибки (нажмите для просмотра)</summary>
                    <pre style="background: #f5f5f5; padding: 10px; margin-top: 5px; overflow: auto; font-size: 12px;">${errorStack}</pre>
                </details>
                <small style="display: block; margin-top: 10px;">
                    Убедитесь, что вы запустили: <code>node admin/generate-index.js</code><br>
                    Проверьте консоль браузера (F12) для дополнительной информации.
                </small>
            </div>`;
    }
}

async function loadChapterData(chapterId) {
    // Получаем реальное имя папки (может быть с префиксом)
    // Сначала пытаемся найти папку с префиксом, затем без
    let folderName = chapterId;
    let basePath = `/chapters/${chapterId}/`;
    
    // Пытаемся найти папку с префиксом (формат: 001.chapter_id)
    // Загружаем индекс, чтобы получить правильный путь
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
                // Извлекаем имя папки из пути
                const pathParts = basePath.split('/').filter(p => p);
                if (Array.isArray(pathParts) && pathParts.length > 0) {
                    folderName = pathParts[pathParts.length - 1] || chapterId;
                }
            }
        }
    } catch (e) {
        console.warn('Не удалось загрузить индекс для определения пути:', e);
    }
    
    let chapter = {
        id: chapterId,
        path: basePath,
        errors: []
    };

    // Загружаем outline
    try {
        const outlineRes = await fetch(`${basePath}01-outline.json`);
        if (outlineRes.ok) {
            const outline = await outlineRes.json();
            chapter.outline = outline.chapter_outline || outline;
            chapter.title = chapter.outline.title || chapterId;
            chapter.title_short = chapter.outline.title_short;
            chapter.description = chapter.outline.description;
            chapter.level = chapter.outline.level;
            chapter.order = chapter.outline.order || 0;
            chapter.section_id = chapter.outline.section_id || chapter.section_id;
        } else {
            chapter.errors.push(`Outline: ${outlineRes.status} ${outlineRes.statusText}`);
        }
    } catch (e) {
        chapter.errors.push(`Outline: ${e.message}`);
        console.warn(`Не удалось загрузить outline для ${chapterId}:`, e);
    }

    // Загружаем final (полную версию)
    try {
        const finalRes = await fetch(`${basePath}05-final.json`);
        if (finalRes.ok) {
            const final = await finalRes.json();
            chapter.final = final;
            chapter.title = final.title || chapter.title;
            chapter.title_short = final.title_short || chapter.title_short;
            chapter.description = final.description || chapter.description;
            chapter.level = final.level || chapter.level;
            chapter.order = final.order || chapter.order || 0;
            chapter.section_id = final.section_id || chapter.section_id;
            
            // Подсчитываем вопросы
            if (final.question_bank && Array.isArray(final.question_bank.questions)) {
                chapter.totalQuestions = final.question_bank.questions.length;
            }
            
            // Подсчитываем блоки теории
            if (Array.isArray(final.blocks)) {
                chapter.theoryBlocks = final.blocks.filter(b => b.type === 'theory').length;
            }
        } else {
            chapter.errors.push(`Final: ${finalRes.status} ${finalRes.statusText}`);
        }
    } catch (e) {
        chapter.errors.push(`Final: ${e.message}`);
        console.warn(`Не удалось загрузить final для ${chapterId}:`, e);
    }

    // Загружаем validation
    try {
        const validationRes = await fetch(`${basePath}05-validation.json`);
        if (validationRes.ok) {
            const validation = await validationRes.json();
            chapter.validation = validation;
            chapter.isValid = validation.validation_result?.is_valid || false;
            chapter.hasValidation = true;
        } else {
            chapter.hasValidation = false;
            chapter.errors.push(`Validation: ${validationRes.status} ${validationRes.statusText}`);
        }
    } catch (e) {
        chapter.hasValidation = false;
        chapter.errors.push(`Validation: ${e.message}`);
    }

    // Если нет данных, используем ID как заголовок
    if (!chapter.title) {
        chapter.title = chapterId;
    }

    return chapter;
}

function updateStats() {
    if (!Array.isArray(allChapters)) {
        allChapters = [];
    }
    const total = allChapters.length;
    const valid = allChapters.filter(c => c.isValid === true).length;
    const invalid = allChapters.filter(c => c.isValid === false && c.hasValidation).length;
    const totalQuestions = allChapters.reduce((sum, c) => sum + (c.totalQuestions || 0), 0);

    document.getElementById('totalChapters').textContent = total;
    document.getElementById('validChapters').textContent = valid;
    document.getElementById('invalidChapters').textContent = invalid;
    document.getElementById('totalQuestions').textContent = totalQuestions;
}

function renderChapters() {
    const container = document.getElementById('chaptersList');
    
    // Проверяем, что filteredChapters - массив
    if (!Array.isArray(filteredChapters)) {
        filteredChapters = Array.isArray(allChapters) ? [...allChapters] : [];
    }
    
    if (!filteredChapters || filteredChapters.length === 0) {
        container.innerHTML = '<div class="error">Главы не найдены</div>';
        return;
    }

    // Группируем главы по section_id
    const groupedChapters = {};
    if (Array.isArray(filteredChapters)) {
        filteredChapters.forEach(chapter => {
            if (chapter) {
                const sectionId = chapter.section_id || 'other';
                if (!groupedChapters[sectionId]) {
                    groupedChapters[sectionId] = [];
                }
                groupedChapters[sectionId].push(chapter);
            }
        });
    }

        // Определяем порядок разделов и глав
        let sectionIds = [];
        let sectionOrderMap = {};
        let sectionTitleMap = {};
        let chapterOrderInSection = {};
        
        if (generationStatus && Array.isArray(generationStatus.sections)) {
            // Используем порядок из generation-status.json
            for (const section of generationStatus.sections) {
                if (section && section.section_id) {
                    sectionIds.push(section.section_id);
                    sectionOrderMap[section.section_id] = section.order !== undefined ? section.order : 999;
                    sectionTitleMap[section.section_id] = section.title || section.section_id;
                    
                    // Создаем мапу порядка глав внутри раздела
                    if (Array.isArray(section.chapter_ids)) {
                        section.chapter_ids.forEach((chapterId, index) => {
                            if (!chapterOrderInSection[section.section_id]) {
                                chapterOrderInSection[section.section_id] = {};
                            }
                            chapterOrderInSection[section.section_id][chapterId] = index;
                        });
                    }
                }
            }
            
            // Добавляем разделы, которых нет в generation-status (если есть)
            for (const sectionId of Object.keys(groupedChapters)) {
                if (!sectionIds.includes(sectionId)) {
                    sectionIds.push(sectionId);
                    sectionOrderMap[sectionId] = 9999;
                    sectionTitleMap[sectionId] = sectionId.replace(/^en\.grammar\./, '').replace(/\./g, ' / ');
                }
            }
            
            // Сортируем разделы по order из generation-status
            if (Array.isArray(sectionIds)) {
                sectionIds.sort((a, b) => {
                    const orderA = sectionOrderMap[a] !== undefined ? sectionOrderMap[a] : 9999;
                    const orderB = sectionOrderMap[b] !== undefined ? sectionOrderMap[b] : 9999;
                    return orderA - orderB;
                });
            }
            
            // Сортируем главы внутри каждого раздела по порядку из chapter_ids
            sectionIds.forEach(sectionId => {
                if (Array.isArray(groupedChapters[sectionId])) {
                    if (chapterOrderInSection[sectionId]) {
                        groupedChapters[sectionId].sort((a, b) => {
                            const orderA = chapterOrderInSection[sectionId][a.id] !== undefined 
                                ? chapterOrderInSection[sectionId][a.id] 
                                : 9999;
                            const orderB = chapterOrderInSection[sectionId][b.id] !== undefined 
                                ? chapterOrderInSection[sectionId][b.id] 
                                : 9999;
                            return orderA - orderB;
                        });
                    } else {
                        // Fallback: сортируем по order из данных главы
                        groupedChapters[sectionId].sort((a, b) => (a.order || 0) - (b.order || 0));
                    }
                }
            });
        } else {
            // Fallback: сортируем разделы по ID
            sectionIds = Object.keys(groupedChapters);
            if (Array.isArray(sectionIds)) {
                sectionIds.sort();
            }
            sectionIds.forEach(sectionId => {
                if (Array.isArray(groupedChapters[sectionId])) {
                    groupedChapters[sectionId].sort((a, b) => (a.order || 0) - (b.order || 0));
                }
            });
        }

    // Формируем HTML с группами
    container.innerHTML = sectionIds.map(sectionId => {
        const chapters = groupedChapters[sectionId];
        
        // Проверяем, что chapters существует и является массивом
        if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
            return ''; // Пропускаем разделы без глав
        }
        
        const sectionName = sectionTitleMap[sectionId] || sectionId.replace(/^en\.grammar\./, '').replace(/\./g, ' / ') || sectionId;
        const chaptersCount = chapters.length;
        
        return `
            <div class="section-group">
                <div class="section-header">
                    <h2 class="section-title">${sectionName}</h2>
                    <div class="section-meta">
                        <span class="section-id">${sectionId}</span>
                        <span class="section-count">${chaptersCount} ${chaptersCount === 1 ? 'глава' : chaptersCount < 5 ? 'главы' : 'глав'}</span>
                    </div>
                </div>
                <div class="section-chapters">
                    ${chapters.map(chapter => renderChapterCard(chapter)).join('')}
                </div>
            </div>
        `;
    }).filter(html => html).join(''); // Убираем пустые строки
}

function renderChapterCard(chapter) {
    const validationBadge = chapter.hasValidation 
        ? (chapter.isValid 
            ? '<span class="badge badge-valid">✓ Валидна</span>' 
            : '<span class="badge badge-invalid">✗ Ошибки</span>')
        : '<span class="badge badge-no-validation">? Нет валидации</span>';

    const levelBadge = chapter.level 
        ? `<span class="badge badge-level">${chapter.level}</span>` 
        : '';

    const hasData = chapter.final || chapter.outline;
    const dataStatus = hasData 
        ? '' 
        : '<div style="margin-top: 10px; padding: 10px; background: #fff3e0; border-radius: 6px; font-size: 12px; color: #e65100;">⚠️ Данные не загружены. Проверьте консоль браузера (F12) для деталей.</div>';

    const errorsInfo = chapter.errors && chapter.errors.length > 0
        ? `<div style="margin-top: 10px; padding: 10px; background: #ffebee; border-radius: 6px; font-size: 12px; color: #c62828;">
            <strong>Ошибки загрузки:</strong><br>
            ${chapter.errors.map(e => `• ${e}`).join('<br>')}
           </div>`
        : '';

    return `
        <div class="chapter-card" onclick="openChapter('${chapter.id}')">
            <div class="chapter-card-header">
                <div>
                    <div class="chapter-title">${chapter.title || chapter.id}</div>
                    <div class="chapter-id">${chapter.id}</div>
                </div>
                <div class="chapter-badges">
                    ${levelBadge}
                    ${validationBadge}
                </div>
            </div>
            ${chapter.description ? `<div class="chapter-description">${chapter.description}</div>` : ''}
            ${!hasData ? '<div class="chapter-description" style="color: #e65100; font-style: italic;">⚠️ Данные главы не загружены</div>' : ''}
            <div class="chapter-meta">
                ${chapter.title_short ? `<div class="meta-item">📝 ${chapter.title_short}</div>` : ''}
                ${chapter.order !== undefined ? `<div class="meta-item">#${chapter.order}</div>` : ''}
            </div>
            <div class="chapter-stats">
                ${chapter.theoryBlocks ? `<div class="stat-item">📚 Блоков теории: ${chapter.theoryBlocks}</div>` : ''}
                ${chapter.totalQuestions ? `<div class="stat-item">❓ Вопросов: ${chapter.totalQuestions}</div>` : ''}
                ${!hasData ? '<div class="stat-item" style="color: #e65100;">⚠️ Нет данных</div>' : ''}
            </div>
            ${errorsInfo}
        </div>
    `;
}

function openChapter(chapterId) {
    window.location.href = `chapter.html?id=${chapterId}`;
}

// Поиск и фильтрация
document.getElementById('searchInput').addEventListener('input', (e) => {
    filterChapters();
});

document.getElementById('levelFilter').addEventListener('change', () => {
    filterChapters();
});

document.getElementById('statusFilter').addEventListener('change', () => {
    filterChapters();
});

function filterChapters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const levelFilter = document.getElementById('levelFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    // Убеждаемся, что allChapters - массив
    if (!Array.isArray(allChapters)) {
        allChapters = [];
    }

    filteredChapters = allChapters.filter(chapter => {
        // Поиск
        if (searchTerm) {
            const matchesSearch = 
                (chapter.title || '').toLowerCase().includes(searchTerm) ||
                (chapter.id || '').toLowerCase().includes(searchTerm) ||
                (chapter.description || '').toLowerCase().includes(searchTerm) ||
                (chapter.title_short || '').toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
        }

        // Фильтр по уровню
        if (levelFilter && chapter.level !== levelFilter) {
            return false;
        }

        // Фильтр по статусу
        if (statusFilter === 'valid' && !chapter.isValid) {
            return false;
        }
        if (statusFilter === 'invalid' && (chapter.isValid || !chapter.hasValidation)) {
            return false;
        }
        if (statusFilter === 'no-validation' && chapter.hasValidation) {
            return false;
        }

        return true;
    });

    renderChapters();
}

// Загрузка при старте
loadChapters();
