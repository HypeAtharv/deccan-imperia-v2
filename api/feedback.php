<?php
/**
 * Deccan Imperia — AI Feedback & Rating Endpoint
 */

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = @json_decode($raw, true);

$rating = $data['rating'] ?? ''; // 'up' or 'down'
$query = trim($data['query'] ?? '');
$reply = trim($data['reply'] ?? '');

if (empty($rating) || empty($query)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
    exit;
}

// If negative feedback, flag in unresolved_queries for review
if ($rating === 'down') {
    $file = __DIR__ . '/../data/unresolved_queries.json';
    $existing = [];
    if (file_exists($file)) {
        $existing = @json_decode(file_get_contents($file), true) ?: [];
    }
    $existing[] = [
        'date' => date('Y-m-d H:i:s'),
        'query' => $query,
        'user_feedback' => 'thumbs_down',
        'bot_reply' => $reply,
        'status' => 'pending_improvement'
    ];
    @file_put_contents($file, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

echo json_encode(['success' => true]);
