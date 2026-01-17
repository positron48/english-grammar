/**
 * Простой рендерер Markdown для отображения теории
 */

/**
 * Рендерит markdown текст в HTML
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Сначала обрабатываем inline markdown (жирный текст, курсив, ссылки) для всего текста
    // Это важно для правильной обработки в prompt'ах вопросов
    // Жирный текст - делаем это раньше, чтобы не конфликтовало с другими правилами
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Курсив - только одинарные звездочки, не двойные
    // Используем более простое регулярное выражение без lookbehind
    html = html.replace(/([^*]|^)\*([^*\n]+?)\*([^*]|$)/g, (match, before, text, after) => {
        // Если это не часть двойной звездочки (которая уже обработана)
        if (before !== '*' && after !== '*') {
            return before + '<em>' + text + '</em>' + after;
        }
        return match;
    });
    
    // Ссылки
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
    
    // Заголовки (после inline markdown, чтобы не конфликтовали)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Обработка списков построчно
    const lines = html.split('\n');
    const processedLines = [];
    let inOrderedList = false;
    let inUnorderedList = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Проверяем нумерованный список
        const orderedMatch = trimmed.match(/^(\d+)\. (.*)$/);
        if (orderedMatch) {
            // Если были в маркированном списке, закрываем его
            if (inUnorderedList) {
                processedLines.push('</ul>');
                inUnorderedList = false;
            }
            // Если не были в нумерованном списке, открываем его
            if (!inOrderedList) {
                processedLines.push('<ol>');
                inOrderedList = true;
            }
            // Добавляем элемент списка (markdown уже обработан выше)
            processedLines.push(`<li>${orderedMatch[2]}</li>`);
            continue;
        }
        
        // Проверяем маркированный список
        const unorderedMatch = trimmed.match(/^\- (.*)$/);
        if (unorderedMatch) {
            // Если были в нумерованном списке, закрываем его
            if (inOrderedList) {
                processedLines.push('</ol>');
                inOrderedList = false;
            }
            // Если не были в маркированном списке, открываем его
            if (!inUnorderedList) {
                processedLines.push('<ul>');
                inUnorderedList = true;
            }
            // Добавляем элемент списка (markdown уже обработан выше)
            processedLines.push(`<li>${unorderedMatch[1]}</li>`);
            continue;
        }
        
        // Если строка не является элементом списка
        // Закрываем открытые списки
        if (inOrderedList) {
            processedLines.push('</ol>');
            inOrderedList = false;
        }
        if (inUnorderedList) {
            processedLines.push('</ul>');
            inUnorderedList = false;
        }
        
        // Добавляем обычную строку (markdown уже обработан выше)
        if (trimmed) {
            processedLines.push(line);
        } else {
            processedLines.push('');
        }
    }
    
    // Закрываем списки в конце
    if (inOrderedList) {
        processedLines.push('</ol>');
    }
    if (inUnorderedList) {
        processedLines.push('</ul>');
    }
    
    // Объединяем строки обратно
    html = processedLines.join('\n');
    
    // Параграфы - обрабатываем только то, что не является уже HTML тегами
    const paragraphs = html.split('\n\n');
    html = paragraphs.map(para => {
        para = para.trim();
        if (!para) return '';
        // Если уже HTML тег (список, заголовок), не оборачиваем в <p>
        if (para.match(/^<(h[1-6]|ul|ol|li|p|div|a|strong|em)/i) || para.startsWith('</')) {
            return para;
        }
        // Если строка начинается с HTML тега и не содержит переносов, не оборачиваем
        if (para.startsWith('<') && !para.includes('\n')) {
            return para;
        }
        // Если это многострочный контент с HTML тегами, возвращаем как есть
        if (para.includes('<') && para.includes('>')) {
            // Но проверяем, что это не просто один HTML тег
            const tags = para.match(/<[^>]+>/g);
            if (tags && tags.length > 0 && para.length > tags.join('').length) {
                // Есть текст вне тегов, оборачиваем в <p>
                return `<p>${para}</p>`;
            }
            return para;
        }
        return `<p>${para}</p>`;
    }).join('\n\n');
    
    // Убираем лишние переносы строк
    html = html.replace(/\n{3,}/g, '\n\n');
    
    return html;
}

/**
 * Рендерит inline markdown (без обработки списков и параграфов)
 * Используется для prompt'ов вопросов и других inline элементов
 */
export function renderInlineMarkdown(text) {
    if (!text) return '';
    
    let html = text;
    
    // Заменяем одиночные переносы строк на пробелы, чтобы текст не разбивался на параграфы
    // Но сохраняем двойные переносы для структурных элементов
    html = html.replace(/([^\n])\n([^\n])/g, '$1 $2');
    
    // Жирный текст
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Курсив (только одинарные *)
    html = html.replace(/([^*]|^)\*([^*\n]+?)\*([^*]|$)/g, (match, before, text, after) => {
        if (before !== '*' && after !== '*') {
            return before + '<em>' + text + '</em>' + after;
        }
        return match;
    });
    
    // Ссылки
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
    
    return html;
}
