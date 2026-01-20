/**
 * Модуль для загрузки данных курса из JSON файлов
 */

// Базовый путь к папке с главами (относительно test/)
const CHAPTERS_BASE_PATH = '../chapters/';

// Кэш для generation-status
let generationStatusCache = null;

/**
 * Загружает generation-status.json для получения порядка разделов и глав
 */
async function loadGenerationStatus() {
    if (generationStatusCache) {
        return generationStatusCache;
    }
    
    try {
        const timestamp = new Date().getTime();
        // Пробуем разные пути (зависит от того, откуда открыта страница)
        const possiblePaths = [
            '../config/generation-status.json',
            'config/generation-status.json',
            '../config/generation-status.json?t=' + timestamp
        ];
        
        let status = null;
        for (const path of possiblePaths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    status = await response.json();
                    console.log(`✓ generation-status.json загружен: ${path}`);
                    generationStatusCache = status;
                    return status;
                }
            } catch (error) {
                // Пробуем следующий путь
                continue;
            }
        }
        
        console.warn('⚠️ Не удалось загрузить generation-status.json, используется сортировка по умолчанию');
        console.warn('   Пробовал пути:', possiblePaths);
        return null;
    } catch (error) {
        console.warn('⚠️ Ошибка загрузки generation-status.json:', error);
        return null;
    }
}

/**
 * Загружает список всех глав из папки chapters
 */
export async function loadAllChapters() {
    try {
        // Сначала пытаемся загрузить индексный файл
        // Добавляем timestamp для предотвращения кеширования
        const timestamp = new Date().getTime();
        const indexPath = `data/chapters-index.json?t=${timestamp}`;
        
        let index = null;
        
        try {
            const indexResponse = await fetch(indexPath);
            if (indexResponse.ok) {
                index = await indexResponse.json();
                console.log(`✓ Индексный файл загружен (${index.chapters?.length || 0} глав)`);
            } else {
                console.error(`❌ Ошибка загрузки индекса: ${indexResponse.status} ${indexResponse.statusText}`);
                throw new Error(`Не удалось загрузить индекс: ${indexResponse.status}`);
            }
        } catch (error) {
            console.error('❌ Ошибка при загрузке индексного файла:', error);
            console.error('   Путь:', indexPath);
            throw error;
        }
        
        if (!index || !index.chapters || index.chapters.length === 0) {
            throw new Error('Индексный файл пуст или поврежден');
        }
        
        const chapters = [];
        
        // Загружаем каждую главу из индекса
        for (const chapterInfo of index.chapters || []) {
            try {
                // Используем folder_name если есть (для папок с префиксом), иначе id
                const folderName = chapterInfo.folder_name || chapterInfo.id;
                const chapterPath = `${CHAPTERS_BASE_PATH}${folderName}/05-final.json?t=${timestamp}`;
                const chapterResponse = await fetch(chapterPath);
                if (chapterResponse.ok) {
                    const chapterData = await chapterResponse.json();
                    chapters.push(chapterData);
                } else {
                    console.warn(`⚠️ Глава ${chapterInfo.id} не найдена (${chapterResponse.status}): ${chapterPath}`);
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось загрузить главу ${chapterInfo.id}:`, error);
            }
        }
        
        console.log(`✓ Загружено глав: ${chapters.length} из ${index.chapters?.length || 0}`);
        
        // Загружаем generation-status для правильной сортировки
        const status = await loadGenerationStatus();
        
        if (status) {
            // Создаем карту order для глав из generation-status
            const chapterOrderMap = {};
            for (const chapter of status.chapters || []) {
                chapterOrderMap[chapter.chapter_id] = chapter.order || 999;
            }
            
            // Сортируем по order из generation-status
            chapters.sort((a, b) => {
                const orderA = chapterOrderMap[a.id] !== undefined ? chapterOrderMap[a.id] : (a.order || 999);
                const orderB = chapterOrderMap[b.id] !== undefined ? chapterOrderMap[b.id] : (b.order || 999);
                return orderA - orderB;
            });
        } else {
            // Fallback: сортируем по order из данных глав
            chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        
        return chapters;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки глав:', error);
        throw error;
    }
}

/**
 * Загружает конкретную главу по chapter_id
 */
export async function loadChapter(chapterId) {
    try {
        // Сначала пытаемся загрузить индекс, чтобы найти правильное имя папки
        let folderName = chapterId;
        
        const timestamp = new Date().getTime();
        
        try {
            const indexResponse = await fetch(`data/chapters-index.json?t=${timestamp}`);
            if (indexResponse.ok) {
                const index = await indexResponse.json();
                const chapterInfo = index.chapters.find(c => c.id === chapterId);
                if (chapterInfo && chapterInfo.folder_name) {
                    folderName = chapterInfo.folder_name;
                }
            }
        } catch (e) {
            // Если индекс не загружен, используем chapterId
        }
        
        // Пробуем загрузить с найденным именем папки
        let chapterPath = `${CHAPTERS_BASE_PATH}${folderName}/05-final.json?t=${timestamp}`;
        let response = await fetch(chapterPath);
        
        // Если не найдено, пробуем без префикса
        if (!response.ok && folderName !== chapterId) {
            chapterPath = `${CHAPTERS_BASE_PATH}${chapterId}/05-final.json?t=${timestamp}`;
            response = await fetch(chapterPath);
        }
        
        if (!response.ok) {
            throw new Error(`Глава не найдена: ${chapterId} (пробовал: ${folderName}, ${chapterId})`);
        }
        
        const chapterData = await response.json();
        return chapterData;
    } catch (error) {
        console.error(`Ошибка загрузки главы ${chapterId}:`, error);
        throw error;
    }
}

/**
 * Группирует главы по разделам
 */
export async function groupChaptersBySection(chapters) {
    const sections = {};
    
    // Загружаем generation-status для правильной сортировки и получения данных разделов
    const status = await loadGenerationStatus();
    
    for (const chapter of chapters) {
        const sectionId = chapter.section_id || 'unknown';
        
        if (!sections[sectionId]) {
            // Получаем title и order из generation-status или используем fallback
            let sectionTitle = sectionId.replace(/en\.grammar\./g, '').replace(/_/g, ' ');
            let sectionOrder = 999;
            
            if (status) {
                for (const sectionData of status.sections || []) {
                    if (sectionData.section_id === sectionId) {
                        sectionTitle = sectionData.title || sectionTitle;
                        sectionOrder = sectionData.order || 999;
                        break;
                    }
                }
            }
            
            sections[sectionId] = {
                id: sectionId,
                title: sectionTitle,
                order: sectionOrder,
                chapters: []
            };
            
            // Отладочная информация
            if (sectionId === 'en.grammar.orientation_how_to_read') {
                console.log(`Создан раздел ${sectionId}: order=${sectionOrder}, title=${sectionTitle}`);
            }
        }
        
        sections[sectionId].chapters.push(chapter);
    }
    
    if (status) {
        // Убеждаемся, что order и title установлены для всех разделов из generation-status
        for (const sectionData of status.sections || []) {
            if (sections[sectionData.section_id]) {
                const newOrder = sectionData.order !== undefined ? sectionData.order : 999;
                sections[sectionData.section_id].order = newOrder;
                sections[sectionData.section_id].title = sectionData.title || sections[sectionData.section_id].title;
                
                // Отладочная информация
                if (sectionData.section_id === 'en.grammar.orientation_how_to_read') {
                    console.log(`Обновлен раздел ${sectionData.section_id}: order=${newOrder} из generation-status`);
                }
            }
        }
        
        // Создаем карту order для глав из generation-status
        const chapterOrderMap = {};
        for (const chapter of status.chapters || []) {
            chapterOrderMap[chapter.chapter_id] = chapter.order || 999;
        }
        
        // Сортируем главы внутри разделов по order из generation-status
        for (const sectionId in sections) {
            sections[sectionId].chapters.sort((a, b) => {
                const orderA = chapterOrderMap[a.id] !== undefined ? chapterOrderMap[a.id] : (a.order || 999);
                const orderB = chapterOrderMap[b.id] !== undefined ? chapterOrderMap[b.id] : (b.order || 999);
                return orderA - orderB;
            });
        }
    } else {
        // Fallback: сортируем главы по order из данных глав
        for (const sectionId in sections) {
            sections[sectionId].chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
    }
    
    return sections;
}


/**
 * Получает вопрос по ID из банка вопросов
 */
export function getQuestionById(chapter, questionId) {
    if (!chapter.question_bank || !chapter.question_bank.questions) {
        return null;
    }
    
    return chapter.question_bank.questions.find(q => q.id === questionId) || null;
}

/**
 * Получает несколько вопросов по ID
 */
export function getQuestionsByIds(chapter, questionIds) {
    return questionIds
        .map(id => getQuestionById(chapter, id))
        .filter(q => q !== null);
}
