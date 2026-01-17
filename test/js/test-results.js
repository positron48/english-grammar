/**
 * Модуль для работы с результатами тестов в localStorage
 */

const STORAGE_KEY = 'grammar_course_test_results';

/**
 * Сохраняет результат теста
 */
export function saveTestResult(chapterId, result) {
    const results = getTestResults();
    
    results[chapterId] = {
        chapterId,
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        correctCount: result.correctCount,
        completedAt: new Date().toISOString(),
        details: result.details || []
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

/**
 * Получает все результаты тестов
 */
export function getTestResults() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Ошибка чтения результатов из localStorage:', error);
        return {};
    }
}

/**
 * Получает результат теста для конкретной главы
 */
export function getTestResult(chapterId) {
    const results = getTestResults();
    return results[chapterId] || null;
}

/**
 * Удаляет результат теста для главы
 */
export function clearTestResult(chapterId) {
    const results = getTestResults();
    delete results[chapterId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

/**
 * Очищает все результаты
 */
export function clearAllResults() {
    localStorage.removeItem(STORAGE_KEY);
}
