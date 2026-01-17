/**
 * Модуль для рендеринга вопросов различных типов
 */

import { renderMarkdown, renderInlineMarkdown } from './markdown-renderer.js';

/**
 * Рендерит вопрос любого типа
 */
export function renderQuestion(question, showAnswers = false, onAnswer = null) {
    if (!question) return '';
    
    const container = document.createElement('div');
    container.className = `question question-${question.type}`;
    container.dataset.questionId = question.id;
    
    const promptDiv = document.createElement('div');
    promptDiv.className = 'question-prompt';
    // Рендерим inline markdown в prompt (без параграфов, чтобы жирный текст не переносился)
    promptDiv.innerHTML = renderInlineMarkdown(question.prompt || '');
    container.appendChild(promptDiv);
    
    let answerContainer;
    
    switch (question.type) {
        case 'mcq_single':
            answerContainer = renderMcqSingle(question, showAnswers, onAnswer);
            break;
        case 'mcq_multi':
            answerContainer = renderMcqMulti(question, showAnswers, onAnswer);
            break;
        case 'fill_blank':
            answerContainer = renderFillBlank(question, showAnswers, onAnswer);
            break;
        case 'reorder':
            answerContainer = renderReorder(question, showAnswers, onAnswer);
            break;
        case 'true_false':
            answerContainer = renderTrueFalse(question, showAnswers, onAnswer);
            break;
        case 'error_spotting':
            answerContainer = renderErrorSpotting(question, showAnswers, onAnswer);
            break;
        default:
            answerContainer = document.createElement('div');
            answerContainer.textContent = 'Тип вопроса не поддерживается';
    }
    
    container.appendChild(answerContainer);
    
    if (question.explanation && showAnswers) {
        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'question-explanation';
        // Рендерим markdown в объяснении
        const explanationHtml = renderMarkdown(`**Объяснение:** ${question.explanation}`);
        explanationDiv.innerHTML = explanationHtml;
        container.appendChild(explanationDiv);
    }
    
    return container;
}

/**
 * Рендерит вопрос с одним правильным ответом (mcq_single)
 */
function renderMcqSingle(question, showAnswers, onAnswer) {
    const container = document.createElement('div');
    container.className = 'question-choices';
    
    const choices = question.choices || [];
    const correctAnswer = question.correct_answer;
    
    choices.forEach(choice => {
        const label = document.createElement('label');
        label.className = 'choice';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question-${question.id}`;
        input.value = choice.id;
        input.disabled = showAnswers;
        
        if (showAnswers && choice.id === correctAnswer) {
            label.classList.add('correct');
        }
        if (showAnswers && choice.feedback) {
            label.classList.add('has-feedback');
        }
        
        const text = document.createElement('span');
        text.textContent = choice.text;
        
        label.appendChild(input);
        label.appendChild(text);
        
        if (showAnswers && choice.feedback) {
            const feedback = document.createElement('div');
            feedback.className = 'choice-feedback';
            feedback.textContent = choice.feedback;
            label.appendChild(feedback);
        }
        
        if (!showAnswers && onAnswer) {
            input.addEventListener('change', () => {
                onAnswer(question.id, choice.id);
            });
        }
        
        container.appendChild(label);
    });
    
    return container;
}

/**
 * Рендерит вопрос с несколькими правильными ответами (mcq_multi)
 */
function renderMcqMulti(question, showAnswers, onAnswer) {
    const container = document.createElement('div');
    container.className = 'question-choices';
    
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
        input.disabled = showAnswers;
        
        if (showAnswers && correctAnswers.includes(choice.id)) {
            label.classList.add('correct');
        }
        
        const text = document.createElement('span');
        text.textContent = choice.text;
        
        label.appendChild(input);
        label.appendChild(text);
        
        if (showAnswers && choice.feedback) {
            const feedback = document.createElement('div');
            feedback.className = 'choice-feedback';
            feedback.textContent = choice.feedback;
            label.appendChild(feedback);
        }
        
        if (!showAnswers && onAnswer) {
            input.addEventListener('change', () => {
                const checked = Array.from(container.querySelectorAll('input:checked'))
                    .map(inp => inp.value);
                onAnswer(question.id, checked);
            });
        }
        
        container.appendChild(label);
    });
    
    return container;
}

/**
 * Рендерит вопрос на заполнение пропуска (fill_blank)
 */
function renderFillBlank(question, showAnswers, onAnswer) {
    const container = document.createElement('div');
    container.className = 'question-fill-blank';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fill-blank-input';
    input.disabled = showAnswers;
    input.placeholder = 'Введите ответ';
    
    if (showAnswers) {
        input.value = question.correct_answer || '';
        input.classList.add('correct');
    }
    
    if (!showAnswers && onAnswer) {
        input.addEventListener('input', () => {
            onAnswer(question.id, input.value.trim());
        });
    }
    
    container.appendChild(input);
    
    return container;
}

/**
 * Рендерит вопрос на перестановку слов (reorder)
 */
function renderReorder(question, showAnswers, onAnswer) {
    const container = document.createElement('div');
    container.className = 'question-reorder';
    
    // Простая реализация - показываем textarea для ввода
    const textarea = document.createElement('textarea');
    textarea.className = 'reorder-textarea';
    textarea.rows = 3;
    textarea.placeholder = 'Введите предложение в правильном порядке';
    textarea.disabled = showAnswers;
    
    if (showAnswers) {
        textarea.value = question.correct_answer || '';
        textarea.classList.add('correct');
    }
    
    if (!showAnswers && onAnswer) {
        textarea.addEventListener('input', () => {
            onAnswer(question.id, textarea.value.trim());
        });
    }
    
    container.appendChild(textarea);
    
    return container;
}

/**
 * Рендерит вопрос True/False
 */
function renderTrueFalse(question, showAnswers, onAnswer) {
    const container = document.createElement('div');
    container.className = 'question-true-false';
    
    const correctAnswer = question.correct_answer === 'true' || question.correct_answer === true;
    
    ['true', 'false'].forEach(value => {
        const label = document.createElement('label');
        label.className = 'choice';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `question-${question.id}`;
        input.value = value;
        input.disabled = showAnswers;
        
        if (showAnswers && (value === 'true' ? correctAnswer : !correctAnswer)) {
            label.classList.add('correct');
        }
        
        const text = document.createElement('span');
        text.textContent = value === 'true' ? 'Верно' : 'Неверно';
        
        label.appendChild(input);
        label.appendChild(text);
        
        if (!showAnswers && onAnswer) {
            input.addEventListener('change', () => {
                onAnswer(question.id, value);
            });
        }
        
        container.appendChild(label);
    });
    
    return container;
}

/**
 * Рендерит вопрос на исправление ошибки (error_spotting)
 */
function renderErrorSpotting(question, showAnswers, onAnswer) {
    // Похож на mcq_single, но с особым оформлением
    return renderMcqSingle(question, showAnswers, onAnswer);
}
