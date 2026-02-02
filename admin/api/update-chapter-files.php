<?php
/**
 * API endpoint для обновления файлов главы
 * POST /admin/api/update-chapter-files.php
 *
 * Body (JSON):
 * {
 *   "chapter_id": "en.grammar.chapter_id",
 *   "questions": [...],
 *   "final": {...}
 * }
 *
 * Логи в stderr (error_log) — собираются Alloy → Loki.
 */
function grammar_log(string $action, array $ctx = []): void {
    $parts = array_map(fn($k, $v) => "$k=" . (is_array($v) ? json_encode($v) : (string)$v), array_keys($ctx), $ctx);
    error_log('[GRAMMAR] ' . date('c') . " action=$action " . implode(' ', $parts));
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['chapter_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request data']);
    exit;
}

$chapterId = $data['chapter_id'];
$projectRoot = dirname(dirname(dirname(__FILE__)));
$chaptersDir = $projectRoot . '/chapters';
$chapterDir = null;

if (is_dir($chaptersDir)) {
    foreach (scandir($chaptersDir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $entryPath = $chaptersDir . '/' . $entry;
        if (is_dir($entryPath)) {
            if ($entry === $chapterId || (preg_match('/^(\d{3})\.(.+)$/', $entry, $m) && $m[2] === $chapterId)) {
                $chapterDir = $entryPath;
                break;
            }
        }
    }
}

if (!$chapterDir || !is_dir($chapterDir)) {
    grammar_log('admin_update_error', ['chapter_id' => $chapterId, 'reason' => 'chapter_not_found']);
    http_response_code(404);
    echo json_encode(['error' => 'Chapter directory not found']);
    exit;
}

$errors = [];
$updated = [];

function json_encode_pretty_2spaces($data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return preg_replace_callback('/^(\s{4})+/m', fn($m) => str_repeat('  ', strlen($m[0]) / 4), $json);
}

if (isset($data['questions'])) {
    $path = $chapterDir . '/03-questions.json';
    if (file_put_contents($path, json_encode_pretty_2spaces(['questions' => $data['questions']])) !== false) {
        $updated[] = '03-questions.json';
    } else {
        $errors[] = 'Failed to update 03-questions.json';
    }
}

if (isset($data['final'])) {
    if (isset($data['final']['meta'])) {
        $data['final']['meta']['updated_at'] = date('Y-m-d\TH:i:s\Z');
    }
    $path = $chapterDir . '/05-final.json';
    if (file_put_contents($path, json_encode_pretty_2spaces($data['final'])) !== false) {
        $updated[] = '05-final.json';
    } else {
        $errors[] = 'Failed to update 05-final.json';
    }
}

$queueFile = $projectRoot . '/config/.push-queue.json';
if (count($errors) === 0 && !empty($updated)) {
    $folderName = basename($chapterDir);
    $queue = file_exists($queueFile) ? (json_decode(file_get_contents($queueFile), true) ?: []) : [];
    $queue['pending'] = $queue['pending'] ?? [];
    $queuedPaths = [];
    foreach ($updated as $f) {
        $path = "chapters/{$folderName}/{$f}";
        $queue['pending'][$path] = 1;
        $queuedPaths[] = $path;
    }
    file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT));
    grammar_log('admin_update', ['chapter_id' => $chapterId, 'files' => $updated, 'queued' => $queuedPaths]);
}

if (count($errors) > 0) {
    grammar_log('admin_update_error', ['chapter_id' => $chapterId, 'errors' => $errors]);
    http_response_code(500);
    echo json_encode(['success' => false, 'errors' => $errors, 'updated' => $updated]);
} else {
    echo json_encode(['success' => true, 'updated' => $updated, 'message' => 'Files updated successfully']);
}
