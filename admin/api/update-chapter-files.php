<?php
/**
 * API endpoint для обновления файлов главы после удаления вопросов
 * POST /admin/api/update-chapter-files.php
 * 
 * Body (JSON):
 * {
 *   "chapter_id": "en.grammar.chapter_id",
 *   "questions": [...],  // обновленный массив вопросов
 *   "quizzes": {...},    // обновленные квизы
 *   "final": {...}       // обновленный final (опционально)
 * }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Получаем данные из запроса
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['chapter_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request data']);
    exit;
}

$chapterId = $data['chapter_id'];
$projectRoot = dirname(dirname(dirname(__FILE__)));

// Получаем путь к папке главы (может быть с префиксом)
$chaptersDir = $projectRoot . '/chapters';
$chapterDir = null;

// Ищем папку с префиксом или без
if (is_dir($chaptersDir)) {
    $entries = scandir($chaptersDir);
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $entryPath = $chaptersDir . '/' . $entry;
        if (is_dir($entryPath)) {
            // Проверяем, соответствует ли имя папки chapter_id (с префиксом или без)
            // Формат префикса: 001.chapter_id
            if ($entry === $chapterId) {
                $chapterDir = $entryPath;
                break;
            } elseif (preg_match('/^(\d{3})\.(.+)$/', $entry, $matches)) {
                // Папка с префиксом: 001.chapter_id
                if ($matches[2] === $chapterId) {
                    $chapterDir = $entryPath;
                    break;
                }
            }
        }
    }
}

if (!$chapterDir || !is_dir($chapterDir)) {
    http_response_code(404);
    echo json_encode(['error' => 'Chapter directory not found']);
    exit;
}

$errors = [];
$updated = [];

// Функция для форматирования JSON с 2 пробелами (вместо стандартных 4)
function json_encode_pretty_2spaces($data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    // Заменяем отступы из 4 пробелов на 2 пробела
    $lines = explode("\n", $json);
    $result = [];
    foreach ($lines as $line) {
        // Заменяем каждые 4 пробела в начале строки на половину (2 пробела за уровень)
        $result[] = preg_replace_callback('/^(\s{4})+/m', function($matches) {
            return str_repeat('  ', strlen($matches[0]) / 4);
        }, $line);
    }
    return implode("\n", $result);
}

// Обновляем 03-questions.json
if (isset($data['questions'])) {
    $questionsFile = $chapterDir . '/03-questions.json';
    $questionsData = ['questions' => $data['questions']];
    
    if (file_put_contents($questionsFile, json_encode_pretty_2spaces($questionsData)) !== false) {
        $updated[] = '03-questions.json';
    } else {
        $errors[] = 'Failed to update 03-questions.json';
    }
}

// 04-inline-quizzes.json больше не используется - квизы генерируются автоматически
// Inline quizzes теперь создаются динамически из первых 2 вопросов каждого theory блока

// Обновляем 05-final.json (если предоставлен)
if (isset($data['final'])) {
    $finalFile = $chapterDir . '/05-final.json';
    
    // Обновляем timestamp
    if (isset($data['final']['meta'])) {
        $data['final']['meta']['updated_at'] = date('Y-m-d\TH:i:s\Z');
    }
    
    if (file_put_contents($finalFile, json_encode_pretty_2spaces($data['final'])) !== false) {
        $updated[] = '05-final.json';
    } else {
        $errors[] = 'Failed to update 05-final.json';
    }
}

if (count($errors) > 0) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'errors' => $errors,
        'updated' => $updated
    ]);
} else {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'updated' => $updated,
        'message' => 'Files updated successfully'
    ]);
}
?>
