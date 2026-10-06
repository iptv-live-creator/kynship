<?php
/* Kynship admin backend — save content.json + upload images + git push */
$ROOT = __DIR__;
$LOG  = "$ROOT/.kyn.log";
function lg($m){ global $LOG; file_put_contents($LOG, date('Y-m-d H:i:s')." $m\n", FILE_APPEND); }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Img-Name, X-Mode');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { echo json_encode(['ok'=>false,'err'=>'POST only']); exit; }

$mode = $_SERVER['HTTP_X_MODE'] ?? 'img';

/* ---------- 1) save content.json ---------- */
if ($mode === 'save') {
    $raw = file_get_contents('php://input');
    $C   = json_decode($raw, true);
    if (!is_array($C)) { echo json_encode(['ok'=>false,'err'=>'invalid json']); exit; }
    $pretty = json_encode($C, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (file_put_contents("$ROOT/content.json", $pretty) === false) {
        echo json_encode(['ok'=>false,'err'=>'cannot write content.json']); exit;
    }
    lg("content.json saved");
    echo json_encode(['ok'=>true, 'push' => push($ROOT)]);
    exit;
}

/* ---------- 2) image upload ---------- */
$name = $_SERVER['HTTP_X_IMG_NAME'] ?? '';
$name = preg_replace('/[^a-zA-Z0-9_.-]/', '', $name);
if ($name === '') $name = 'upload_' . date('Ymd_His') . '.jpg';
$blob = file_get_contents('php://input');
if (strlen($blob) < 1024) { echo json_encode(['ok'=>false,'err'=>'empty image']); exit; }

$tmp = "$ROOT/images/_tmp_$name";
if (file_put_contents($tmp, $blob) === false) { echo json_encode(['ok'=>false,'err'=>'write fail']); exit; }
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $tmp); finfo_close($finfo);
if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) {
    unlink($tmp); echo json_encode(['ok'=>false,'err'=>'not an image']); exit;
}

/* normalize to jpeg, max 1600px */
$im = @imagecreatefromstring($blob);
if ($im) {
    $w = imagesx($im); $h = imagesy($im);
    if ($w > 1600) { $nw = 1600; $nh = (int)($h * 1600 / $w); $im2 = imagecreatetruecolor($nw,$nh);
        imagecopyresampled($im2,$im,0,0,0,0,$nw,$nh,$w,$h); imagedestroy($im); $im = $im2; }
    imagejpeg($im, "$ROOT/images/$name", 84); imagedestroy($im);
    unlink($tmp);
} else { rename($tmp, "$ROOT/images/$name"); }

lg("image uploaded: images/$name");
echo json_encode(['ok'=>true, 'url' => "images/$name", 'push' => push($ROOT)]);
exit;

/* ---------- 3) git add+commit+push ---------- */
function push($ROOT) {
    if (!is_dir("$ROOT/.git")) { lg('no .git — skipping push'); return 'no-git'; }
    $cmds = [
        'git add -A',
        'git -c user.email=admin@kynship.local -c user.name="Kynship Admin" commit -m "admin: update content"',
        'git push origin HEAD 2>&1',
    ];
    $out = '';
    foreach ($cmds as $c) {
        $o = shell_exec('cd ' . escapeshellarg($ROOT) . ' && ' . $c . ' 2>&1');
        $out .= "$c => " . trim((string)$o) . "\n";
    }
    lg("push:\n$out");
    return $out;
}
