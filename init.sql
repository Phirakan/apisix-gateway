-- Create database if not exists
CREATE DATABASE IF NOT EXISTS apisix_db;
USE apisix_db;

-- Create records table for GoFiber backend
CREATE TABLE IF NOT EXISTS records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO records (name, value) VALUES 
('Sample Record 1', 'This is the first sample record'),
('Sample Record 2', 'This is the second sample record'),
('API Test Record', 'Testing API functionality'),
('APISIX Integration', 'Testing APISIX gateway integration'),
('Database Connection', 'Successfully connected to MariaDB');

-- Create user and grant permissions (if needed)
FLUSH PRIVILEGES;