/**
 * Модуль для генерации финальных тестов по стратегии отбора
 */

/**
 * Генерирует финальный тест для главы по стратегии отбора
 */
export function generateChapterTest(chapter) {
    if (!chapter.chapter_test || !chapter.question_bank) {
        throw new Error('Глава не содержит данных для теста');
    }
    
    const testConfig = chapter.chapter_test;
    const questions = chapter.question_bank.questions || [];
    const poolIds = testConfig.pool_question_ids || [];
    const strategy = testConfig.selection_strategy || {};
    
    // Получаем вопросы из пула
    const poolQuestions = questions.filter(q => poolIds.includes(q.id));
    
    let selectedQuestions = [];
    
    switch (strategy.type) {
        case 'stratified_by_theory_block':
            selectedQuestions = selectStratifiedByTheoryBlock(
                poolQuestions,
                testConfig.num_questions,
                strategy
            );
            break;
        default:
            // Простая случайная выборка
            selectedQuestions = selectRandom(poolQuestions, testConfig.num_questions);
    }
    
    // Перемешиваем вопросы
    selectedQuestions = shuffleArray(selectedQuestions);
    
    return selectedQuestions;
}

/**
 * Стратегия: стратифицированный отбор по теоретическим блокам
 */
function selectStratifiedByTheoryBlock(questions, numQuestions, strategy) {
    const minPerBlock = strategy.min_per_theory_block || 1;
    const difficultyMix = strategy.difficulty_mix || {};
    
    // Группируем вопросы по теоретическим блокам
    const byBlock = {};
    for (const question of questions) {
        const blockId = question.theory_block_id || 'unknown';
        if (!byBlock[blockId]) {
            byBlock[blockId] = [];
        }
        byBlock[blockId].push(question);
    }
    
    const selected = [];
    const blockIds = Object.keys(byBlock);
    
    // Сначала выбираем минимум по каждому блоку
    for (const blockId of blockIds) {
        const blockQuestions = byBlock[blockId];
        const shuffled = shuffleArray([...blockQuestions]);
        const toTake = Math.min(minPerBlock, shuffled.length);
        
        for (let i = 0; i < toTake; i++) {
            selected.push(shuffled[i]);
        }
    }
    
    // Если ещё нужно вопросов, выбираем из оставшихся
    const remaining = questions.filter(q => !selected.includes(q));
    const stillNeeded = Math.max(0, numQuestions - selected.length);
    
    if (stillNeeded > 0 && remaining.length > 0) {
        const shuffledRemaining = shuffleArray([...remaining]);
        selected.push(...shuffledRemaining.slice(0, stillNeeded));
    }
    
    // Если слишком много выбрано, обрезаем до нужного количества
    if (selected.length > numQuestions) {
        return shuffleArray(selected).slice(0, numQuestions);
    }
    
    return selected;
}

/**
 * Простая случайная выборка
 */
function selectRandom(questions, num) {
    const shuffled = shuffleArray([...questions]);
    return shuffled.slice(0, Math.min(num, shuffled.length));
}

/**
 * Перемешивает массив (Fisher-Yates)
 */
function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Проверяет ответ на вопрос
 */
export function checkAnswer(question, userAnswer) {
    if (!question) return { correct: false, score: 0 };
    
    const correctAnswer = question.correct_answer;
    
    switch (question.type) {
        case 'mcq_single':
        case 'true_false':
        case 'error_spotting':
            return {
                correct: userAnswer === correctAnswer,
                score: userAnswer === correctAnswer ? 1 : 0
            };
        
        case 'mcq_multi':
            const correctArray = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
            const userArray = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
            const isCorrect = arraysEqual(correctArray.sort(), userArray.sort());
            return {
                correct: isCorrect,
                score: isCorrect ? 1 : 0
            };
        
        case 'fill_blank':
        case 'reorder':
            const normalized = (str) => str.toLowerCase().trim();
            return {
                correct: normalized(userAnswer) === normalized(correctAnswer),
                score: normalized(userAnswer) === normalized(correctAnswer) ? 1 : 0
            };
        
        default:
            return { correct: false, score: 0 };
    }
}

/**
 * Сравнивает два массива
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
}
