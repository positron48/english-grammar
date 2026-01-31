<?php
/**
 * API endpoint для обновления файлов главы после удаления вопросов
 * POST /admin/api/update-chapter-files.php
 * 
 * Записывает в PVC и пушит изменения в Git через GitHub API.
 * Требует env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
 * 
 * Body (JSON):
 * {
 *   "chapter_id": "en.grammar.chapter_id",
 *   "questions": [...],
 *   "quizzes": {...},
 *   "final": {...}
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

// Push to Git via GitHub API (если токен настроен)
$pushedToGit = [];
$gitDebug = ['env' => [
    'owner' => getenv('GITHUB_OWNER') ?: '(empty)',
    'repo' => getenv('GITHUB_REPO') ?: '(empty)',
    'token' => getenv('GITHUB_TOKEN') ? '***set***' : '(empty)',
]];
if (count($errors) === 0 && !empty($updated)) {
    $token = getenv('GITHUB_TOKEN');
    $owner = getenv('GITHUB_OWNER');
    $repo = getenv('GITHUB_REPO');
    if (!$token || !$owner || !$repo) {
        $missing = array_filter([
            !$token ? 'GITHUB_TOKEN' : null,
            !$owner ? 'GITHUB_OWNER' : null,
            !$repo ? 'GITHUB_REPO' : null,
        ]);
        $gitDebug['skipped'] = 'env missing: ' . implode(', ', $missing);
    } else {
        $folderName = basename($chapterDir);
        $pushErrors = [];
        foreach ($updated as $filename) {
            $filePath = "chapters/{$folderName}/{$filename}";
            $fullPath = $chapterDir . '/' . $filename;
            if (file_exists($fullPath)) {
                $content = file_get_contents($fullPath);
                $result = pushFileToGitHub($token, $owner, $repo, $filePath, $content, "Update {$filename} via admin");
                if ($result['ok']) {
                    $pushedToGit[] = $filePath;
                } else {
                    $err = $filePath . ': ' . $result['error'];
                    if (!empty($result['detail'])) {
                        $err .= ' | ' . json_encode($result['detail']);
                    }
                    $pushErrors[] = $err;
                }
            }
        }
        if (!empty($pushErrors)) {
            $gitDebug['errors'] = $pushErrors;
        }
    }
}

if (count($errors) > 0) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'errors' => $errors,
        'updated' => $updated,
        'pushed_to_git' => $pushedToGit,
        'git_debug' => $gitDebug
    ]);
} else {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'updated' => $updated,
        'pushed_to_git' => $pushedToGit,
        'git_debug' => $gitDebug,
        'message' => 'Files updated successfully'
    ]);
}

/**
 * Push or update file in GitHub repo via REST API.
 * Uses shell curl (работает в pod, PHP curl даёт 403).
 */
function pushFileToGitHub(string $token, string $owner, string $repo, string $path, string $content, string $message): array {
    $token = trim($token);
    $url = "https://api.github.com/repos/" . rawurlencode($owner) . "/" . rawurlencode($repo) . "/contents/" . rawurlencode($path);

    $body = [
        'message' => $message,
        'content' => base64_encode($content)
    ];

    $getCmd = sprintf(
        'curl -s -H %s -H "Accept: application/vnd.github.v3+json" %s',
        escapeshellarg('Authorization: token ' . $token),
        escapeshellarg($url)
    );
    $response = shell_exec($getCmd);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['sha'])) {
            $body['sha'] = $data['sha'];
        }
    }

    $jsonBody = json_encode($body);
    $tmpFile = tempnam(sys_get_temp_dir(), 'git');
    file_put_contents($tmpFile, $jsonBody);

    $cmd = sprintf(
        'curl -s -w "%%{http_code}" -X PUT -H %s -H "Accept: application/vnd.github.v3+json" -H "Content-Type: application/json" -d @%s %s',
        escapeshellarg('Authorization: token ' . $token),
        escapeshellarg($tmpFile),
        escapeshellarg($url)
    );
    $output = shell_exec($cmd);
    @unlink($tmpFile);

    if ($output === null) {
        return ['ok' => false, 'error' => 'shell_exec failed'];
    }
    $httpCode = (int) substr($output, -3);
    $responseBody = substr($output, 0, -3);

    if ($httpCode >= 200 && $httpCode < 300) {
        return ['ok' => true, 'error' => null];
    }
    $errMsg = "HTTP {$httpCode}";
    $detail = null;
    if ($responseBody) {
        $decoded = json_decode($responseBody, true);
        if (isset($decoded['message'])) {
            $errMsg = $decoded['message'];
        }
        if ($httpCode === 403 && $decoded) {
            $detail = $decoded;
        }
    }
    return ['ok' => false, 'error' => $errMsg, 'detail' => $detail];
}
?>
