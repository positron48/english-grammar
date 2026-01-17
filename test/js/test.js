/**
 * Страница финального теста
 */

import { loadChapter } from './data-loader.js';
import { renderQuestion } from './quiz-renderer.js';
import { generateChapterTest, checkAnswer } from './test-generator.js';
import { saveTestResult, getTestResult } from './test-results.js';

let chapter = null;
let testQuestions = [];
let userAnswers = {};
let currentQuestionIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const chapterId = params.get('chapter');
    
    if (!chapterId) {
        alert('Глава не указана');
        window.location.href = 'index.html';
        return;
    }
    
    const loadingEl = document.getElementById('loading');
    const infoEl = document.getElementById('test-info');
    const contentEl = document.getElementById('test-content');
    const resultsEl = document.getElementById('test-results');
    const testTitleEl = document.getElementById('test-title');
    const breadcrumbLinkEl = document.getElementById('breadcrumb-chapter-link');
    
    try {
        // Загружаем главу
        chapter = await loadChapter(chapterId);
        
        // Обновляем навигацию
        testTitleEl.textContent = `Финальный тест: ${chapter.title || chapter.title_short || chapter.id}`;
        breadcrumbLinkEl.textContent = chapter.title || chapter.title_short || chapter.id;
        breadcrumbLinkEl.href = `chapter.html?chapter=${encodeURIComponent(chapterId)}`;
        
        // Генерируем тест
        testQuestions = generateChapterTest(chapter);
        
        const numQuestionsEl = document.getElementById('test-num-questions');
        numQuestionsEl.textContent = testQuestions.length;
        
        // Кнопка начала теста
        document.getElementById('start-test-btn').addEventListener('click', () => {
            infoEl.style.display = 'none';
            contentEl.style.display = 'block';
            showQuestion(0);
        });
        
        // Кнопки навигации
        document.getElementById('prev-question-btn').addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                showQuestion(currentQuestionIndex);
            }
        });
        
        document.getElementById('next-question-btn').addEventListener('click', () => {
            // Проверяем, что текущий вопрос отвечен
            if (!isQuestionAnswered(testQuestions[currentQuestionIndex])) {
                alert('Пожалуйста, ответьте на вопрос перед переходом к следующему.');
                return;
            }
            
            if (currentQuestionIndex < testQuestions.length - 1) {
                currentQuestionIndex++;
                showQuestion(currentQuestionIndex);
            } else {
                finishTest();
            }
        });
        
        document.getElementById('finish-test-btn').addEventListener('click', () => {
            // Проверяем, что текущий вопрос отвечен
            if (!isQuestionAnswered(testQuestions[currentQuestionIndex])) {
                alert('Пожалуйста, ответьте на вопрос перед завершением теста.');
                return;
            }
            
            // Проверяем, что все вопросы отвечены
            const unansweredQuestions = testQuestions.filter(q => !isQuestionAnswered(q));
            if (unansweredQuestions.length > 0) {
                const confirmMessage = `У вас есть ${unansweredQuestions.length} ${unansweredQuestions.length === 1 ? 'неотвеченный вопрос' : 'неотвеченных вопроса'}. Вы уверены, что хотите завершить тест?`;
                if (!confirm(confirmMessage)) {
                    return;
                }
            }
            
            finishTest();
        });
        
        document.getElementById('restart-test-btn').addEventListener('click', () => {
            restartTest();
        });
        
        document.getElementById('back-to-chapter-btn').href = `chapter.html?chapter=${encodeURIComponent(chapterId)}`;
        
        loadingEl.style.display = 'none';
        infoEl.style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки теста:', error);
        loadingEl.textContent = 'Ошибка загрузки теста. Проверьте консоль для деталей.';
    }
});

/**
 * Показывает вопрос
 */
function showQuestion(index) {
    if (index < 0 || index >= testQuestions.length) return;
    
    currentQuestionIndex = index;
    const question = testQuestions[index];
    
    const questionsContainer = document.getElementById('test-questions');
    questionsContainer.innerHTML = '';
    
    // В финальном тесте не проверяем сразу, только сохраняем ответ
    const questionEl = renderQuestion(question, false, (questionId, answer) => {
        // Сохраняем ответ только если он не пустой
        if (answer !== undefined && answer !== null && answer !== '') {
            // Для multi-choice проверяем, что есть хотя бы один выбор
            if (question.type === 'mcq_multi') {
                const answers = Array.isArray(answer) ? answer : [answer];
                if (answers.length > 0) {
                    userAnswers[questionId] = answer;
                } else {
                    delete userAnswers[questionId];
                }
            } else if (question.type === 'fill_blank' || question.type === 'reorder') {
                // Для текстовых полей проверяем, что не пустая строка
                if (answer.trim().length > 0) {
                    userAnswers[questionId] = answer;
                } else {
                    delete userAnswers[questionId];
                }
            } else {
                userAnswers[questionId] = answer;
            }
        } else {
            delete userAnswers[questionId];
        }
        
        updateNavigation();
    }, false); // checkImmediately = false для финального теста
    
    // Если уже есть ответ, восстанавливаем его
    if (userAnswers[question.id] !== undefined) {
        restoreAnswer(questionEl, question, userAnswers[question.id]);
    }
    
    questionsContainer.appendChild(questionEl);
    
    updateProgress();
    updateNavigation();
}

/**
 * Восстанавливает ответ пользователя
 */
function restoreAnswer(questionEl, question, answer) {
    switch (question.type) {
        case 'mcq_single':
        case 'true_false':
        case 'error_spotting':
            const radio = questionEl.querySelector(`input[value="${answer}"]`);
            if (radio) radio.checked = true;
            break;
        case 'mcq_multi':
            if (Array.isArray(answer)) {
                answer.forEach(val => {
                    const checkbox = questionEl.querySelector(`input[value="${val}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
            break;
        case 'fill_blank':
        case 'reorder':
            const input = questionEl.querySelector('input, textarea');
            if (input) input.value = answer;
            break;
    }
}

/**
 * Обновляет прогресс
 */
function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    const progress = ((currentQuestionIndex + 1) / testQuestions.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Вопрос ${currentQuestionIndex + 1} из ${testQuestions.length}`;
}

/**
 * Проверяет, отвечен ли вопрос
 */
function isQuestionAnswered(question) {
    if (!question) return false;
    
    const userAnswer = userAnswers[question.id];
    
    if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
        return false;
    }
    
    // Для multi-choice проверяем, что выбран хотя бы один вариант
    if (question.type === 'mcq_multi') {
        const answers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
        return answers.length > 0;
    }
    
    // Для текстовых полей проверяем, что не пустая строка
    if (question.type === 'fill_blank' || question.type === 'reorder') {
        return userAnswer.trim().length > 0;
    }
    
    return true;
}

/**
 * Обновляет кнопки навигации
 */
function updateNavigation() {
    const prevBtn = document.getElementById('prev-question-btn');
    const nextBtn = document.getElementById('next-question-btn');
    const finishBtn = document.getElementById('finish-test-btn');
    
    prevBtn.disabled = currentQuestionIndex === 0;
    
    const currentQuestion = testQuestions[currentQuestionIndex];
    const isAnswered = isQuestionAnswered(currentQuestion);
    
    // Подсвечиваем кнопки, если вопрос не отвечен
    if (!isAnswered) {
        nextBtn.style.borderColor = 'var(--error-color)';
        nextBtn.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
        if (finishBtn.style.display !== 'none') {
            finishBtn.style.borderColor = 'var(--error-color)';
            finishBtn.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
        }
    } else {
        nextBtn.style.borderColor = '';
        nextBtn.style.boxShadow = '';
        finishBtn.style.borderColor = '';
        finishBtn.style.boxShadow = '';
    }
    
    if (currentQuestionIndex === testQuestions.length - 1) {
        nextBtn.style.display = 'none';
        finishBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        finishBtn.style.display = 'none';
    }
}

/**
 * Завершает тест и показывает результаты
 */
function finishTest() {
    const contentEl = document.getElementById('test-content');
    const resultsEl = document.getElementById('test-results');
    
    // Проверяем ответы
    let correctCount = 0;
    let totalScore = 0;
    const results = [];
    
    for (const question of testQuestions) {
        const userAnswer = userAnswers[question.id];
        const result = checkAnswer(question, userAnswer);
        
        results.push({
            question,
            userAnswer,
            ...result
        });
        
        if (result.correct) {
            correctCount++;
        }
        totalScore += result.score;
    }
    
    const percentage = Math.round((correctCount / testQuestions.length) * 100);
    
    // Сохраняем результат в localStorage
    const testResult = {
        score: correctCount,
        total: testQuestions.length,
        percentage: percentage,
        correctCount: correctCount,
        details: results
    };
    
    const params = new URLSearchParams(window.location.search);
    const chapterId = params.get('chapter');
    if (chapterId) {
        saveTestResult(chapterId, testResult);
    }
    
    // Показываем результаты
    renderResults(results, correctCount, totalScore);
    
    contentEl.style.display = 'none';
    resultsEl.style.display = 'block';
}

/**
 * Рендерит результаты теста
 */
function renderResults(results, correctCount, totalScore) {
    const scoreEl = document.getElementById('test-score');
    const detailsEl = document.getElementById('test-details');
    
    const percentage = Math.round((correctCount / results.length) * 100);
    
    scoreEl.innerHTML = `
        <div class="test-score-summary">
            <h2>Результат: ${correctCount} из ${results.length}</h2>
            <div class="score-percentage">${percentage}%</div>
            <div class="score-bar">
                <div class="score-fill" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
    
    detailsEl.innerHTML = '<h3>Детали:</h3>';
    
    results.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = `test-result-item ${result.correct ? 'correct' : 'incorrect'}`;
        
        const userAnswerDisplay = formatAnswer(result.question, result.userAnswer);
        const correctAnswerDisplay = formatAnswer(result.question, result.question.correct_answer);
        
        resultItem.innerHTML = `
            <div class="result-question">
                <strong>Вопрос ${index + 1}:</strong> ${result.question.prompt}
            </div>
            <div class="result-answers">
                <div class="result-user-answer">
                    <strong>Ваш ответ:</strong> ${userAnswerDisplay || '(не отвечено)'}
                </div>
                ${!result.correct ? `
                    <div class="result-correct-answer">
                        <strong>Правильный ответ:</strong> ${correctAnswerDisplay}
                    </div>
                ` : ''}
                ${result.question.explanation ? `
                    <div class="result-explanation">
                        ${result.question.explanation}
                    </div>
                ` : ''}
            </div>
        `;
        
        detailsEl.appendChild(resultItem);
    });
}

/**
 * Форматирует ответ для отображения
 */
function formatAnswer(question, answer) {
    if (answer === undefined || answer === null) return '';
    
    if (question.type === 'mcq_single' || question.type === 'error_spotting' || question.type === 'true_false') {
        if (question.type === 'true_false') {
            return answer === 'true' || answer === true ? 'Верно' : 'Неверно';
        }
        const choice = question.choices?.find(c => c.id === answer);
        return choice ? choice.text : answer;
    }
    
    if (question.type === 'mcq_multi') {
        const answers = Array.isArray(answer) ? answer : [answer];
        const choices = answers.map(a => {
            const choice = question.choices?.find(c => c.id === a);
            return choice ? choice.text : a;
        });
        return choices.join(', ');
    }
    
    return String(answer);
}

/**
 * Перезапускает тест
 */
function restartTest() {
    userAnswers = {};
    currentQuestionIndex = 0;
    
    const contentEl = document.getElementById('test-content');
    const resultsEl = document.getElementById('test-results');
    
    resultsEl.style.display = 'none';
    contentEl.style.display = 'block';
    
    // Регенерируем тест (чтобы получить новый набор вопросов)
    testQuestions = generateChapterTest(chapter);
    
    showQuestion(0);
}
