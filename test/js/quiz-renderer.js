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
    
    // Объяснение вопроса (показываем после ответа, не сразу)
    if (question.explanation) {
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
            // Для reorder используем специальную обработку ниже
            if (question.type === 'fill_blank') {
                const input = container.querySelector('.fill-blank-input');
                const answerContainer = container.querySelector('.question-fill-blank');
                if (input && answerContainer) {
                    if (isCorrect) {
                        input.classList.add('answer-correct');
                    } else {
                        input.classList.add('answer-incorrect');
                    }
                    input.disabled = true;
                    
                    // Показываем правильный ответ ниже инпута
                    if (!isCorrect) {
                        // Проверяем, нет ли уже блока с правильным ответом
                        if (!answerContainer.querySelector('.correct-answer-display')) {
                            const correctAnswerDiv = document.createElement('div');
                            correctAnswerDiv.className = 'correct-answer-display';
                            correctAnswerDiv.innerHTML = `<strong>Правильный ответ:</strong> ${question.correct_answer}`;
                            // Добавляем после inputWrapper (ниже инпута)
                            answerContainer.appendChild(correctAnswerDiv);
                        }
                    }
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
        // Размещаем feedback внутри label, но после всего содержимого
        if (choice.feedback) {
            const feedback = document.createElement('div');
            feedback.className = 'choice-feedback';
            feedback.style.display = 'none'; // Скрываем по умолчанию
            feedback.dataset.choiceId = choice.id;
            feedback.textContent = choice.feedback;
            // Добавляем в конец label, чтобы не ломать layout
            label.appendChild(feedback);
        }
        
        // Обработка выбора ответа (всегда)
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
                    
                    // Показываем feedback для выбранного варианта (выбранный пользователем)
                    const feedback = label.querySelector('.choice-feedback');
                    if (feedback) {
                        feedback.style.display = 'block';
                    }
                    
                    // Показываем feedback для правильного ответа (если пользователь выбрал неправильно)
                    if (!result.correct) {
                        const correctLabel = answerContainer.querySelector(`input[value="${correctAnswer}"]`)?.closest('.choice');
                        if (correctLabel) {
                            const correctFeedback = correctLabel.querySelector('.choice-feedback');
                            if (correctFeedback) {
                                correctFeedback.style.display = 'block';
                            }
                        }
                    }
                    
                    // Показываем общее объяснение вопроса после проверки
                    const explanationDiv = questionContainer.querySelector('[data-explanation="true"]');
                    if (explanationDiv) {
                        explanationDiv.style.display = 'block';
                    }
                }
            }
        });
        
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
        
        if (choice.feedback) {
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
                            
                            // Показываем общее объяснение вопроса
                            const explanationDiv = questionContainer.querySelector('[data-explanation="true"]');
                            if (explanationDiv) {
                                explanationDiv.style.display = 'block';
                            }
                        }
                    }
                }, 300);
            }
        });
        
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
    
    // Обертка для input и кнопки (inline)
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'fill-blank-wrapper';
    inputWrapper.style.display = 'flex';
    inputWrapper.style.alignItems = 'center';
    inputWrapper.style.gap = '10px';
    
    inputWrapper.appendChild(input);
    
    // Кнопка проверки для fill_blank (показываем если checkImmediately = true)
    if (checkImmediately) {
        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn-check-answer';
        checkBtn.textContent = 'Проверить';
        
        checkBtn.addEventListener('click', () => {
            const userAnswer = input.value.trim();
            if (userAnswer) {
                if (onAnswer) {
                    onAnswer(question.id, userAnswer);
                }
                const questionContainer = container.closest('.question');
                if (questionContainer) {
                    checkAndShowResult(questionContainer, question, userAnswer);
                    
                    // Показываем общее объяснение вопроса
                    const explanationDiv = questionContainer.querySelector('[data-explanation="true"]');
                    if (explanationDiv) {
                        explanationDiv.style.display = 'block';
                    }
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
        
        inputWrapper.appendChild(checkBtn);
    }
    
    answerContainer.appendChild(inputWrapper);
    
    if (!checkImmediately && onAnswer) {
        input.addEventListener('input', () => {
            onAnswer(question.id, input.value.trim());
        });
    }
    
    return answerContainer;
}

/**
 * Рендерит вопрос на перестановку слов (reorder) - интерактивный выбор слов
 */
function renderReorder(question, showAnswers, onAnswer, checkImmediately, container) {
    const answerContainer = document.createElement('div');
    answerContainer.className = 'question-reorder';
    
    // Получаем правильный ответ и разбиваем на слова
    const correctAnswer = question.correct_answer || '';
    // Разбиваем на слова, убирая знаки препинания из списка слов для выбора
    const words = correctAnswer
        .replace(/[.,!?;:]/g, '') // Убираем знаки препинания
        .split(/\s+/)
        .filter(w => w.trim().length > 0);
    
    // Перемешиваем слова
    const shuffledWords = shuffleArray([...words]);
    
    // Контейнер для выбранных слов (предложение)
    const sentenceContainer = document.createElement('div');
    sentenceContainer.className = 'reorder-sentence';
    sentenceContainer.style.minHeight = '50px';
    sentenceContainer.style.padding = '15px';
    sentenceContainer.style.border = '2px dashed var(--border-color)';
    sentenceContainer.style.borderRadius = 'var(--border-radius)';
    sentenceContainer.style.marginBottom = '15px';
    sentenceContainer.style.display = 'flex';
    sentenceContainer.style.flexWrap = 'wrap';
    sentenceContainer.style.gap = '5px';
    sentenceContainer.style.alignItems = 'center';
    sentenceContainer.dataset.sentence = '';
    
    // Контейнер для доступных слов
    const wordsContainer = document.createElement('div');
    wordsContainer.className = 'reorder-words';
    wordsContainer.style.display = 'flex';
    wordsContainer.style.flexWrap = 'wrap';
    wordsContainer.style.gap = '8px';
    wordsContainer.style.marginBottom = '15px';
    
    // Храним выбранные слова
    const selectedWords = [];
    
    // Функция для создания слова-кнопки
    function createWordButton(word, isInSentence = false) {
        const wordBtn = document.createElement('button');
        wordBtn.type = 'button';
        wordBtn.className = 'reorder-word-btn';
        wordBtn.textContent = word;
        wordBtn.style.padding = '8px 12px';
        wordBtn.style.border = '2px solid var(--border-color)';
        wordBtn.style.borderRadius = 'var(--border-radius)';
        wordBtn.style.background = isInSentence ? 'var(--bg-color)' : 'var(--surface-color)';
        wordBtn.style.cursor = 'pointer';
        wordBtn.style.fontSize = '1em';
        wordBtn.style.transition = 'all 0.2s';
        
        wordBtn.addEventListener('mouseenter', () => {
            if (!wordBtn.disabled) {
                wordBtn.style.borderColor = 'var(--primary-color)';
                wordBtn.style.transform = 'translateY(-2px)';
            }
        });
        
        wordBtn.addEventListener('mouseleave', () => {
            if (!wordBtn.disabled) {
                wordBtn.style.borderColor = 'var(--border-color)';
                wordBtn.style.transform = 'translateY(0)';
            }
        });
        
        return wordBtn;
    }
    
    // Функция для проверки ответа
    function checkReorderAnswer() {
        // Собираем предложение: объединяем слова, убираем лишние пробелы
        let userSentence = selectedWords.join(' ').replace(/\s+/g, ' ').trim();
        
        // Добавляем точку в конец, если она была в оригинальном ответе
        // (точка не была в списке слов для выбора)
        if (correctAnswer.trim().match(/[.!?]$/)) {
            const lastPunctuation = correctAnswer.trim().match(/[.!?]$/)[0];
            userSentence += lastPunctuation;
        }
        
        if (onAnswer) {
            onAnswer(question.id, userSentence);
        }
        
        if (checkImmediately) {
            const questionContainer = container.closest('.question');
            if (questionContainer) {
                const result = checkAndShowResult(questionContainer, question, userSentence);
                
                // Отключаем все кнопки
                answerContainer.querySelectorAll('.reorder-word-btn').forEach(btn => {
                    btn.disabled = true;
                    if (result.correct) {
                        // Все слова правильные - зеленый цвет
                        btn.style.borderColor = 'var(--success-color)';
                        btn.style.background = '#dcfce7';
                        btn.style.color = '#166534';
                    } else {
                        // Неправильный ответ - красный для слов в предложении
                        if (btn.parentNode === sentenceContainer) {
                            btn.style.borderColor = 'var(--error-color)';
                            btn.style.background = '#fee2e2';
                            btn.style.color = '#991b1b';
                        }
                        // Слова в списке доступных оставляем как есть
                    }
                });
                
                // Показываем правильный ответ
                if (!result.correct) {
                    const correctAnswerDiv = document.createElement('div');
                    correctAnswerDiv.className = 'correct-answer-display';
                    correctAnswerDiv.innerHTML = `<strong>Правильный ответ:</strong> ${correctAnswer}`;
                    answerContainer.appendChild(correctAnswerDiv);
                }
                
                // Показываем общее объяснение вопроса
                const explanationDiv = questionContainer.querySelector('[data-explanation="true"]');
                if (explanationDiv) {
                    explanationDiv.style.display = 'block';
                }
            }
        }
    }
    
    // Обработка клика на слово в списке доступных
    shuffledWords.forEach(word => {
        const wordBtn = createWordButton(word, false);
        
        wordBtn.addEventListener('click', () => {
            if (wordBtn.disabled) return;
            
            // Перемещаем слово в предложение
            selectedWords.push(word);
            wordBtn.remove();
            
            // Создаем слово в предложении
            const sentenceWordBtn = createWordButton(word, true);
            sentenceWordBtn.addEventListener('click', () => {
                if (sentenceWordBtn.disabled) return;
                
                // Возвращаем слово в список доступных
                const wordIndex = selectedWords.indexOf(word);
                if (wordIndex > -1) {
                    selectedWords.splice(wordIndex, 1);
                }
                sentenceWordBtn.remove();
                
                // Возвращаем кнопку в список
                wordsContainer.appendChild(wordBtn);
                
                // Проверяем, все ли слова выбраны
                if (selectedWords.length === words.length) {
                    checkReorderAnswer();
                }
            });
            
            sentenceContainer.appendChild(sentenceWordBtn);
            sentenceContainer.dataset.sentence = selectedWords.join(' ');
            
            // Проверяем, все ли слова выбраны
            if (selectedWords.length === words.length) {
                checkReorderAnswer();
            }
        });
        
        wordsContainer.appendChild(wordBtn);
    });
    
    answerContainer.appendChild(sentenceContainer);
    answerContainer.appendChild(wordsContainer);
    
    return answerContainer;
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
        text.textContent = value === 'true' ? 'Да' : 'Нет';
        
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
                    
                    // Показываем общее объяснение вопроса
                    const explanationDiv = questionContainer.querySelector('[data-explanation="true"]');
                    if (explanationDiv) {
                        explanationDiv.style.display = 'block';
                    }
                }
            }
        });
        
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
