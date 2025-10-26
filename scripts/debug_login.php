<?php
define('CARBONTRACK_NO_EMIT', true);
$boot = include 'backend/public/index.php';
$app = $boot['app'];
$factory = new Slim\Psr7\Factory\ServerRequestFactory();
$request = $factory->createServerRequest('OPTIONS', '/api/v1/auth/login');
$response = $app->handle($request);
var_dump($response->getStatusCode());
var_dump($response->getHeaders());


