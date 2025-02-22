<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Simple response simulation
$data = [
    "status" => "success",
    "message" => "PHP backend connected to Node.js!"
];

echo json_encode($data);
?>
