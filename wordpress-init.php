<?php
/**
 * WordPress CORS และ REST API Fix
 */

// เพิ่ม CORS headers สำหรับ REST API
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: false');
        header('Access-Control-Max-Age: 86400');
        
        // Handle preflight requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit();
        }
        
        return $value;
    });
});

// เพิ่ม CORS สำหรับ wp-json requests ทั้งหมด
add_action('init', function () {
    if (strpos($_SERVER['REQUEST_URI'], '/wp-json/') !== false) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: false');
        
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit();
        }
    }
});

// เปิดใช้งาน REST API
add_filter('rest_enabled', '__return_true');
add_filter('rest_jsonp_enabled', '__return_true');

// สร้าง sample posts ถ้ายังไม่มี
add_action('wp_loaded', function () {
    if (!get_option('sample_posts_created')) {
        // สร้าง sample posts
        $sample_posts = [
            [
                'post_title' => 'Welcome to APISIX WordPress API',
                'post_content' => 'This is a sample post created for testing APISIX gateway integration with WordPress REST API.',
                'post_status' => 'publish',
                'post_type' => 'post'
            ],
            [
                'post_title' => 'API Gateway Testing',
                'post_content' => 'Testing API gateway functionality with WordPress backend. This post demonstrates REST API capabilities.',
                'post_status' => 'publish',
                'post_type' => 'post'
            ],
            [
                'post_title' => 'WordPress REST API Demo',
                'post_content' => 'This post shows how WordPress REST API works through APISIX gateway. Perfect for testing API endpoints.',
                'post_status' => 'publish',
                'post_type' => 'post'
            ]
        ];
        
        foreach ($sample_posts as $post_data) {
            wp_insert_post($post_data);
        }
        
        update_option('sample_posts_created', true);
    }
});

// Debug information
add_action('rest_api_init', function () {
    error_log('WordPress REST API initialized');
});
?>