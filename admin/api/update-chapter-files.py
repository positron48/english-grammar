#!/usr/bin/env python3
"""
API endpoint для обновления файлов главы после удаления вопросов
Использование с Python http.server через CGI или как отдельный скрипт
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

def get_project_root():
    """Определяет корневую директорию проекта"""
    current = Path(__file__).resolve()
    # admin/api/update-chapter-files.py -> 3 уровня вверх
    return current.parent.parent.parent

def find_chapter_dir(chapters_dir, chapter_id):
    """Находит папку главы (может быть с префиксом или без)"""
    if not os.path.exists(chapters_dir):
        return None
    
    for entry in os.listdir(chapters_dir):
        entry_path = os.path.join(chapters_dir, entry)
        if os.path.isdir(entry_path):
            # Проверяем, соответствует ли имя папки chapter_id (с префиксом или без)
            if entry == chapter_id or (entry.startswith(chapter_id) and len(entry) > len(chapter_id) + 4):
                # Проверяем формат префикса: 001.chapter_id
                if entry.startswith(chapter_id) or (len(entry) > 4 and entry[3] == '.' and entry[4:] == chapter_id):
                    return entry_path
    return None

def update_files(chapter_id, data):
    """Обновляет файлы главы"""
    project_root = get_project_root()
    chapters_dir = os.path.join(project_root, 'chapters')
    
    # Находим папку главы
    chapter_dir = find_chapter_dir(chapters_dir, chapter_id)
    if not chapter_dir:
        return {'success': False, 'error': 'Chapter directory not found'}
    
    errors = []
    updated = []
    
    # Обновляем 03-questions.json
    if 'questions' in data:
        questions_file = os.path.join(chapter_dir, '03-questions.json')
        questions_data = {'questions': data['questions']}
        
        try:
            with open(questions_file, 'w', encoding='utf-8') as f:
                json.dump(questions_data, f, ensure_ascii=False, indent=2)
            updated.append('03-questions.json')
        except Exception as e:
            errors.append(f'Failed to update 03-questions.json: {str(e)}')
    
    # Обновляем 04-inline-quizzes.json
    if 'quizzes' in data:
        quizzes_file = os.path.join(chapter_dir, '04-inline-quizzes.json')
        
        try:
            with open(quizzes_file, 'w', encoding='utf-8') as f:
                json.dump(data['quizzes'], f, ensure_ascii=False, indent=2)
            updated.append('04-inline-quizzes.json')
        except Exception as e:
            errors.append(f'Failed to update 04-inline-quizzes.json: {str(e)}')
    
    # Обновляем 05-final.json (если предоставлен)
    if 'final' in data:
        final_file = os.path.join(chapter_dir, '05-final.json')
        
        # Обновляем timestamp
        if 'meta' in data['final']:
            data['final']['meta']['updated_at'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        
        try:
            with open(final_file, 'w', encoding='utf-8') as f:
                json.dump(data['final'], f, ensure_ascii=False, indent=2)
            updated.append('05-final.json')
        except Exception as e:
            errors.append(f'Failed to update 05-final.json: {str(e)}')
    
    if errors:
        return {'success': False, 'errors': errors, 'updated': updated}
    else:
        return {'success': True, 'updated': updated, 'message': 'Files updated successfully'}

def main():
    """Обработка HTTP запроса"""
    # Для CGI или прямого вызова
    if os.environ.get('REQUEST_METHOD') == 'POST' or len(sys.argv) > 1:
        # Читаем данные из stdin (CGI) или из аргументов
        if os.environ.get('REQUEST_METHOD') == 'POST':
            content_length = int(os.environ.get('CONTENT_LENGTH', 0))
            input_data = sys.stdin.read(content_length)
        else:
            # Для тестирования - читаем из файла или stdin
            input_data = sys.stdin.read() if not sys.stdin.isatty() else '{}'
        
        try:
            data = json.loads(input_data)
        except json.JSONDecodeError:
            print("Content-Type: application/json\n")
            print(json.dumps({'error': 'Invalid JSON'}))
            sys.exit(1)
        
        if 'chapter_id' not in data:
            print("Content-Type: application/json\n")
            print(json.dumps({'error': 'chapter_id is required'}))
            sys.exit(1)
        
        result = update_files(data['chapter_id'], data)
        print("Content-Type: application/json\n")
        print(json.dumps(result))
    else:
        print("Content-Type: application/json\n")
        print(json.dumps({'error': 'Method not allowed'}))

if __name__ == '__main__':
    main()
