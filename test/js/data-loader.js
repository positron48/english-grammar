/**
 * Модуль для загрузки данных курса из JSON файлов
 */

// Базовый путь к папке с главами (относительно test/)
const CHAPTERS_BASE_PATH = '../chapters/';

/**
 * Загружает список всех глав из папки chapters
 */
export async function loadAllChapters() {
    try {
        // Получаем список папок с главами из chapters/
        const chapters = [];
        
        // Список доступных глав (пока хардкод, можно сделать динамический)
        const chapterFolders = [
            'en.grammar.orientation_how_to_read.subject_verb_object_in',
            'en.grammar.orientation_how_to_read.verb_forms_v1_v2',
            'en.grammar.orientation_how_to_read.sentence_modes_statement_question',
            'en.grammar.orientation_how_to_read.micro_skill_find_the'
        ];

        for (const folder of chapterFolders) {
            try {
                const chapterPath = `${CHAPTERS_BASE_PATH}${folder}/05-final.json`;
                const response = await fetch(chapterPath);
                if (response.ok) {
                    const chapterData = await response.json();
                    chapters.push(chapterData);
                }
            } catch (error) {
                console.warn(`Не удалось загрузить главу ${folder}:`, error);
            }
        }

        // Сортируем по order
        chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        return chapters;
    } catch (error) {
        console.error('Ошибка загрузки глав:', error);
        throw error;
    }
}

/**
 * Загружает конкретную главу по chapter_id
 */
export async function loadChapter(chapterId) {
    try {
        // Находим папку главы (chapter_id соответствует имени папки)
        const chapterPath = `${CHAPTERS_BASE_PATH}${chapterId}/05-final.json`;
        const response = await fetch(chapterPath);
        
        if (!response.ok) {
            throw new Error(`Глава не найдена: ${chapterId}`);
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
export function groupChaptersBySection(chapters) {
    const sections = {};
    
    for (const chapter of chapters) {
        const sectionId = chapter.section_id || 'unknown';
        
        if (!sections[sectionId]) {
            sections[sectionId] = {
                id: sectionId,
                title: getSectionTitle(sectionId),
                chapters: []
            };
        }
        
        sections[sectionId].chapters.push(chapter);
    }
    
    // Сортируем главы внутри разделов
    for (const sectionId in sections) {
        sections[sectionId].chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    return sections;
}

/**
 * Получает заголовок раздела (можно расширить)
 */
function getSectionTitle(sectionId) {
    const titles = {
        'en.grammar.orientation_how_to_read': 'Section 0. Orientation: How to read grammar (A0)',
        'en.grammar.first_sentences_be': 'Section 1. First sentences: BE as the sentence engine (A0–A1)',
        // Добавить остальные при необходимости
    };
    
    return titles[sectionId] || sectionId;
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
