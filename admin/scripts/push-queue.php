#!/usr/bin/env php
<?php
/**
 * Push очереди изменений в Git. Вызывается CronJob раз в час.
 * CLI only — при вызове по HTTP ничего не делает.
 * Логи в stdout/stderr — собираются Alloy → Loki.
 */
if (php_sapi_name() !== 'cli') {
    http_response_code(404);
    exit;
}

function grammar_log(string $action, array $ctx = []): void {
    $parts = array_map(fn($k, $v) => "$k=" . (is_array($v) ? json_encode($v) : (string)$v), array_keys($ctx), $ctx);
    $line = '[GRAMMAR] ' . date('c') . " action=$action " . implode(' ', $parts) . "\n";
    fwrite(STDOUT, $line);
}

$projectRoot = dirname(dirname(__DIR__));  // admin/scripts -> html
$queueFile = $projectRoot . '/config/.push-queue.json';

$token = trim(getenv('GITHUB_TOKEN') ?? '');
$owner = getenv('GITHUB_OWNER') ?? '';
$repo = getenv('GITHUB_REPO') ?? '';
if (!$token || !$owner || !$repo) {
    grammar_log('push_env_error', ['msg' => 'Git env not configured']);
    exit(1);
}

if (!file_exists($queueFile)) {
    exit(0);
}

$queue = json_decode(file_get_contents($queueFile), true) ?: [];
$pending = $queue['pending'] ?? [];
if (empty($pending)) {
    grammar_log('push_skip', ['reason' => 'queue_empty']);
    exit(0);
}

grammar_log('push_start', ['count' => count($pending), 'files' => array_keys($pending)]);
$pushed = [];
$errors = [];
foreach (array_keys($pending) as $filePath) {
    $fullPath = $projectRoot . '/' . $filePath;
    if (file_exists($fullPath)) {
        $content = file_get_contents($fullPath);
        $result = pushFileToGitHub($token, $owner, $repo, $filePath, $content, "Update via admin (cron batch)");
        if ($result['ok']) {
            $pushed[] = $filePath;
            unset($pending[$filePath]);
            grammar_log('push_file', ['file' => $filePath, 'status' => 'ok']);
        } else {
            $err = $filePath . ': ' . $result['error'];
            $errors[] = $err;
            grammar_log('push_file', ['file' => $filePath, 'status' => 'error', 'error' => $result['error']]);
        }
    } else {
        unset($pending[$filePath]);
        grammar_log('push_skip_file', ['file' => $filePath, 'reason' => 'not_found']);
    }
}

$queue['pending'] = $pending;
file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT));

if (!empty($errors)) {
    grammar_log('push_done', ['status' => 'error', 'pushed' => count($pushed), 'errors' => count($errors), 'failed' => $errors]);
    exit(1);
}
grammar_log('push_done', ['status' => 'ok', 'pushed' => count($pushed), 'files' => $pushed]);

function pushFileToGitHub(string $token, string $owner, string $repo, string $path, string $content, string $message): array {
    $url = "https://api.github.com/repos/" . rawurlencode($owner) . "/" . rawurlencode($repo) . "/contents/" . rawurlencode($path);
    $body = ['message' => $message, 'content' => base64_encode($content)];

    $getCmd = sprintf('curl -s -H %s -H "Accept: application/vnd.github.v3+json" %s',
        escapeshellarg('Authorization: token ' . $token), escapeshellarg($url));
    $response = shell_exec($getCmd);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['sha'])) {
            $body['sha'] = $data['sha'];
        }
    }

    $tmpFile = tempnam(sys_get_temp_dir(), 'git');
    file_put_contents($tmpFile, json_encode($body));
    $cmd = sprintf('curl -s -w "%%{http_code}" -X PUT -H %s -H "Accept: application/vnd.github.v3+json" -H "Content-Type: application/json" -d @%s %s',
        escapeshellarg('Authorization: token ' . $token), escapeshellarg($tmpFile), escapeshellarg($url));
    $output = shell_exec($cmd);
    @unlink($tmpFile);

    if ($output === null) {
        return ['ok' => false, 'error' => 'shell_exec failed'];
    }
    $httpCode = (int) substr($output, -3);
    if ($httpCode >= 200 && $httpCode < 300) {
        return ['ok' => true];
    }
    $errMsg = "HTTP $httpCode";
    if ($output) {
        $decoded = json_decode(substr($output, 0, -3), true);
        if (isset($decoded['message'])) {
            $errMsg = $decoded['message'];
        }
    }
    return ['ok' => false, 'error' => $errMsg];
}
