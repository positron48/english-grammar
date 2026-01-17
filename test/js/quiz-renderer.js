/**
 * Модуль для рендеринга вопросов различных типов
 */

import { renderMarkdown, renderInlineMarkdown } from './markdown-renderer.js';
import { checkAnswer } from './test-generator.js';

/**
 * Рендерит вопрос любого типа
 */
export function renderQuestion(question, showAnswers = false, onAnswer = null, checkImmediately = false) {
    if (!question) return '';
    
    const container = document.createElement('div');
    container.className = `question question-${question.type}`;
    container.dataset.questionId = question.id;
    
    // Сохраняем данные вопроса для проверки
    container.dataset.question = JSON.stringify(question);
    
    const promptDiv = document.createElement('div');
    promptDiv.className = 'question-prompt';
    // Рендерим inline markdown в prompt (без параграфов, чтобы жирный текст не переносился)
    promptDiv.innerHTML = renderInlineMarkdown(question.prompt || '');
    container.appendChild(promptDiv);
    
    let answerContainer;
    
    switch (question.type) {
        case 'mcq_single':
            answerContainer = renderMcqSingle(question, showAnswers, onAnswer, checkImmediately, container);
            break;
        case 'mcq_multi':
            answerContainer = renderMcqMulti(question, showAnswers, onAnswer, checkImmediately, container);
            break;
        case 'fill_blank':
            answerContainer = renderFillBlank(question, showAnswers, onAnswer, checkImmediately, container);
            break;
        case 'reorder':
            answerContainer = renderReorder(question, showAnswers, onAnswer, checkImmediately, container);
            break;
        case 'true_false':
            answerContainer = renderTrueFalse(question, showAnswers, onAnswer, checkImmediately, container);
            break;
        case 'error_spotting':
            answerContainer = renderErrorSpotting(question, showAnswers, onAnswer, checkImmediately, container);
            break;
        default:
            answerContainer = document.createElement('div');
            answerContainer.textContent = 'Тип вопроса не поддерживается';
    }
    
    container.appendChild(answerContainer);
    
    // Объяснение показываем только если уже показаны ответы
    if (question.explanation && showAnswers) {
        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'question-explanation';
        explanationDiv.style.display = 'none'; // Скрываем по умолчанию
        explanationDiv.dataset.explanation = 'true';
        // Рендерим markdown в объяснении
        const explanationHtml = renderMarkdown(`**Объяснение:** ${question.explanation}`);
        explanationDiv.innerHTML = explanationHtml;
        container.appendChild(explanationDiv);
    }
    
    return container;
}

/**
 * Проверяет ответ и показывает результат
 */
function checkAndShowResult(container, question, userAnswer, showExplanation = true) {
    const result = checkAnswer(question, userAnswer);
    
    // Добавляем класс результата к контейнеру вопроса
    if (result.correct) {
        container.classList.add('question-correct');
    } else {
        container.classList.add('question-incorrect');
    }
    
    // Показываем правильные/неправильные ответы визуально
    highlightAnswers(container, question, result.correct, userAnswer);
    
    // Показываем объяснение
    if (showExplanation && question.explanation) {
        const explanationDiv = container.querySelector('[data-explanation="true"]');
        if (explanationDiv) {
            explanationDiv.style.display = 'block';
        }
    }
    
    return result;
}

/**
 * Подсвечивает правильные и неправильные ответы
 */
function highlightAnswers(container, question, isCorrect, userAnswer) {
    switch (question.type) {
        case 'mcq_single':
        case 'error_spotting':
        case 'true_false':
            const labels = container.querySelectorAll('.choice');
            labels.forEach(label => {
                const input = label.querySelector('input');
                const choiceId = input.value;
                const isCorrectAnswer = choiceId === question.correct_answer;
                const isUserAnswer = choiceId === userAnswer;
                
                if (isCorrectAnswer) {
                    label.classList.add('answer-correct');
                }
                if (isUserAnswer && !isCorrectAnswer) {
                    label.classList.add('answer-incorrect');
                }
                input.disabled = true;
            });
            break;
            
        case 'mcq_multi':
            const multiLabels = container.querySelectorAll('.choice');
            const correctAnswers = Array.isArray(question.correct_answer) 
                ? question.correct_answer 
                : [question.correct_answer];
            const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
            
            multiLabels.forEach(label => {
                const input = label.querySelector('input');
                const choiceId = input.value;
                const isCorrectAnswer = correctAnswers.includes(choiceId);
                const isUserAnswer = userAnswers.includes(choiceId);
                
                if (isCorrectAnswer) {
                    label.classList.add('answer-correct');
                }
                if (isUserAnswer && !isCorrectAnswer) {
                    label.classList.add('answer-incorrect');
                }
                if (isUserAnswer && isCorrectAnswer) {
                    label.classList.add('answer-user-correct');
                }
                input.disabled = true;
            });
            break;
            
        case 'fill_blank':
        case 'reorder':
            const input = container.querySelector('input, textarea');
            if (input) {
                if (isCorrect) {
                    input.classList.add('answer-correct');
                } else {
                    input.classList.add('answer-incorrect');
                }
                input.disabled = true;
                
                // Показываем правильный ответ рядом
                if (!isCorrect) {
                    const correctAnswerDiv = document.createElement('div');
                    correctAnswerDiv.className = 'correct-answer-display';
                    correctAnswerDiv.innerHTML = `<strong>Правильный ответ:</strong> ${question.correct_answer}`;
                    input.parentNode.appendChild(correctAnswerDiv);
                }
            }
            break;
    }
}

/**
 * Рендерит вопрос с одним правильным ответом (mcq_single)
 */
function renderMcqSingle(question, showAnswers, onAnswer, checkImmediately, container) {
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-choices';
    
    const choices = question.choices || [];
    const correctAnswer = question.correct_answer;
    
    choices.forEach(choice => {
        const label = document.createElement('label');
        label.className = 'choice';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question-${question.id}`;
        input.value = choice.id;
        // НЕ отключаем input изначально - только после ответа пользователя
        
        const text = document.createElement('span');
        text.textContent = choice.text;
        
        label.appendChild(input);
        label.appendChild(text);
        
        // Feedback показываем только после ответа
        if (showAnswers && choice.feedback) {
            const feedback = document.createElement('div');
            feedback.className = 'choice-feedback';
            feedback.style.display = 'none'; // Скрываем по умолчанию
            feedback.dataset.choiceId = choice.id;
            feedback.textContent = choice.feedback;
            label.appendChild(feedback);
        }
        
        // Обработка выбора ответа (всегда, так как showAnswers = false)
        input.addEventListener('change', () => {
            const userAnswer = choice.id;
            
            // Сохраняем ответ через callback
            if (onAnswer) {
                onAnswer(question.id, userAnswer);
            }
            
            // Если нужно проверить сразу (checkImmediately = true для inline квизов)
            if (checkImmediately) {
                // Получаем родительский контейнер вопроса
                const questionContainer = container.closest('.question');
                if (questionContainer) {
                    const result = checkAndShowResult(questionContainer, question, userAnswer);
                    
                    // Показываем feedback для выбранного варианта
                    const feedback = label.querySelector('.choice-feedback');
                    if (feedback) {
                        feedback.style.display = 'block';
                    }
                    
                    // Показываем feedback для правильного ответа
                    if (!result.correct) {
                        const correctLabel = answerContainer.querySelector(`input[value="${correctAnswer}"]`)?.closest('.choice');
                        const correctFeedback = correctLabel?.querySelector('.choice-feedback');
                        if (correctFeedback) {
                            correctFeedback.style.display = 'block';
                        }
                    }
                }
            }
        });
        // НЕ показываем правильные ответы сразу, даже если showAnswers = true
        
        answerContainer.appendChild(label);
    });
    
    return answerContainer;
}

/**
 * Рендерит вопрос с несколькими правильными ответами (mcq_multi)
 */
function renderMcqMulti(question, showAnswers, onAnswer, checkImmediately, container) {
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-choices';
    
    const choices = question.choices || [];
    const correctAnswers = Array.isArray(question.correct_answer) 
        ? question.correct_answer 
        : [question.correct_answer];
    
    choices.forEach(choice => {
        const label = document.createElement('label');
        label.className = 'choice';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = `question-${question.id}`;
        input.value = choice.id;
        // НЕ отключаем input изначально - только после ответа пользователя
        
        const text = document.createElement('span');
        text.textContent = choice.text;
        
        label.appendChild(input);
        label.appendChild(text);
        
        if (showAnswers && choice.feedback) {
            const feedback = document.createElement('div');
            feedback.className = 'choice-feedback';
            feedback.style.display = 'none';
            feedback.dataset.choiceId = choice.id;
            feedback.textContent = choice.feedback;
            label.appendChild(feedback);
        }
        
        // Обработка выбора (всегда)
        input.addEventListener('change', () => {
            const checked = Array.from(answerContainer.querySelectorAll('input:checked'))
                .map(inp => inp.value);
            
            if (onAnswer) {
                onAnswer(question.id, checked);
            }
            
            // Для multi можно проверять после каждого выбора или показать кнопку "Проверить"
            // Пока проверяем сразу
            if (checkImmediately) {
                // Ждем небольшой таймаут, чтобы дать возможность выбрать несколько ответов
                setTimeout(() => {
                    const currentChecked = Array.from(answerContainer.querySelectorAll('input:checked'))
                        .map(inp => inp.value);
                    if (currentChecked.length > 0) {
                        const questionContainer = container.closest('.question');
                        if (questionContainer) {
                            checkAndShowResult(questionContainer, question, currentChecked);
                            
                            // Показываем feedback для выбранных вариантов
                            currentChecked.forEach(answerId => {
                                const selectedLabel = answerContainer.querySelector(`input[value="${answerId}"]`)?.closest('.choice');
                                const feedback = selectedLabel?.querySelector('.choice-feedback');
                                if (feedback) {
                                    feedback.style.display = 'block';
                                }
                            });
                        }
                    }
                }, 300);
            }
        });
        // НЕ показываем правильные ответы сразу
        
        answerContainer.appendChild(label);
    });
    
    return answerContainer;
}

/**
 * Рендерит вопрос на заполнение пропуска (fill_blank)
 */
function renderFillBlank(question, showAnswers, onAnswer, checkImmediately, container) {
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-fill-blank';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fill-blank-input';
    // НЕ отключаем input изначально - только после ответа пользователя
    input.placeholder = 'Введите ответ';
    
    // Кнопка проверки для fill_blank (показываем если checkImmediately = true)
    if (checkImmediately) {
        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn-check-answer';
        checkBtn.textContent = 'Проверить';
        checkBtn.style.marginLeft = '10px';
        
        checkBtn.addEventListener('click', () => {
            const userAnswer = input.value.trim();
            if (userAnswer) {
                if (onAnswer) {
                    onAnswer(question.id, userAnswer);
                }
                const questionContainer = container.closest('.question');
                if (questionContainer) {
                    checkAndShowResult(questionContainer, question, userAnswer);
                }
                checkBtn.style.display = 'none';
                input.disabled = true;
            }
        });
        
        // Можно проверять по Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkBtn.click();
            }
        });
        
        answerContainer.appendChild(input);
        answerContainer.appendChild(checkBtn);
    } else {
        answerContainer.appendChild(input);
        
        if (onAnswer) {
            input.addEventListener('input', () => {
                onAnswer(question.id, input.value.trim());
            });
        }
    }
    
    // НЕ показываем правильный ответ сразу
    
    return answerContainer;
}

/**
 * Рендерит вопрос на перестановку слов (reorder)
 */
function renderReorder(question, showAnswers, onAnswer, checkImmediately, container) {
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-reorder';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'reorder-textarea';
    textarea.rows = 3;
    textarea.placeholder = 'Введите предложение в правильном порядке';
    // НЕ отключаем textarea изначально - только после ответа пользователя
    
    // Кнопка проверки для reorder (показываем если checkImmediately = true)
    if (checkImmediately) {
        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn-check-answer';
        checkBtn.textContent = 'Проверить';
        checkBtn.style.marginTop = '10px';
        checkBtn.style.display = 'block';
        
        checkBtn.addEventListener('click', () => {
            const userAnswer = textarea.value.trim();
            if (userAnswer) {
                if (onAnswer) {
                    onAnswer(question.id, userAnswer);
                }
                const questionContainer = container.closest('.question');
                if (questionContainer) {
                    checkAndShowResult(questionContainer, question, userAnswer);
                }
                checkBtn.style.display = 'none';
                textarea.disabled = true;
            }
        });
        
        // Можно проверять по Ctrl+Enter
        textarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                checkBtn.click();
            }
        });
        
        answerContainer.appendChild(textarea);
        answerContainer.appendChild(checkBtn);
    } else {
        answerContainer.appendChild(textarea);
        
        if (onAnswer) {
            textarea.addEventListener('input', () => {
                onAnswer(question.id, textarea.value.trim());
            });
        }
    }
    
    // НЕ показываем правильный ответ сразу
    
    return answerContainer;
}

/**
 * Рендерит вопрос True/False
 */
function renderTrueFalse(question, showAnswers, onAnswer, checkImmediately, container) {
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-true-false';
    
    const correctAnswer = question.correct_answer === 'true' || question.correct_answer === true;
    
    ['true', 'false'].forEach(value => {
        const label = document.createElement('label');
        label.className = 'choice';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question-${question.id}`;
        input.value = value;
        // НЕ отключаем input изначально - только после ответа пользователя
        
        const text = document.createElement('span');
        text.textContent = value === 'true' ? 'Верно' : 'Неверно';
        
        label.appendChild(input);
        label.appendChild(text);
        
        // Обработка выбора (всегда)
        input.addEventListener('change', () => {
            if (onAnswer) {
                onAnswer(question.id, value);
            }
            
            if (checkImmediately) {
                const questionContainer = container.closest('.question');
                if (questionContainer) {
                    checkAndShowResult(questionContainer, question, value);
                }
            }
        });
        // НЕ показываем правильные ответы сразу
        
        answerContainer.appendChild(label);
    });
    
    return answerContainer;
}

/**
 * Рендерит вопрос на исправление ошибки (error_spotting)
 */
function renderErrorSpotting(question, showAnswers, onAnswer, checkImmediately, container) {
    // Похож на mcq_single, но с особым оформлением
    return renderMcqSingle(question, showAnswers, onAnswer, checkImmediately, container);
}
