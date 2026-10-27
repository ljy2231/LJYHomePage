<?php
declare(strict_types=1);
/**
 * 访问计数：PV 每次请求 +1，UV 按 cookie（ljy_uid）去重后 +1。
 * 数据落在同目录 data/counter.json，文件锁保证并发安全。
 * 部署要求：PHP 7.3+，api/data/ 目录对 PHP-FPM 进程可写（建议 755，属主为 www 用户）。
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dir  = __DIR__ . '/data';
$file = $dir . '/counter.json';

if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    http_response_code(500);
    echo json_encode(['error' => 'counter dir not writable'], JSON_UNESCAPED_UNICODE);
    exit;
}

$fp = @fopen($file, 'c+');
if ($fp === false) {
    http_response_code(500);
    echo json_encode(['error' => 'counter file not writable'], JSON_UNESCAPED_UNICODE);
    exit;
}

flock($fp, LOCK_EX); // 独占锁：并发请求排队，避免计数丢失

$raw  = stream_get_contents($fp);
$data = json_decode((string) $raw, true);
if (!is_array($data)) {
    $data = [];
}
$data['pv']    = (int) ($data['pv'] ?? 0);
$data['uv']    = (int) ($data['uv'] ?? 0);
$data['since'] = (string) ($data['since'] ?? date('Y-m-d'));

$firstVisit = !isset($_COOKIE['ljy_uid']);
$data['pv']++;
if ($firstVisit) {
    $data['uv']++;
    setcookie('ljy_uid', bin2hex(random_bytes(16)), [
        'expires'  => time() + 31536000,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode($data, JSON_UNESCAPED_UNICODE);
