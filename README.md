# APISIX Custom Dashboard with WordPress Integration

## 📋 Project Overview

ระบบนี้เป็นการสร้าง API Gateway ด้วย Apache APISIX ที่ทำหน้าที่จัดการ API requests ไปยัง WordPress และ GoFiber backend พร้อมด้วย React Dashboard สำหรับจัดการ routes และ upstreams

## 🏗️ Architecture

```
User Request → APISIX Gateway → WordPress API / GoFiber Backend
                    ↓
React Dashboard ← APISIX Admin API
                    ↓ 
              GoFiber ← MariaDB
```

## 🚀 Services

- **APISIX Gateway** (Port 9080): API Gateway หลัก
- **APISIX Admin API** (Port 9180): Admin API สำหรับจัดการ
- **etcd** (Port 2379): เก็บ configuration ของ APISIX
- **WordPress** (Port 8080): API Provider สำหรับ REST API
- **GoFiber Backend** (Port 3000): Custom API ด้วย Go
- **MariaDB** (Port 3306): Database สำหรับ GoFiber
- **React Dashboard** (Port 3001): Web UI สำหรับจัดการ

## 📦 Quick Start

### 1. Clone Project
```bash
git clone <your-repo>
cd apisix-wordpress-integration
```

### 2. สร้างโฟลเดอร์และไฟล์ตาม Structure
```bash
# สร้างโฟลเดอร์
mkdir -p backend/models
mkdir -p frontend/src/components
mkdir -p frontend/src/services
mkdir -p frontend/public
mkdir -p apisix

# คัดลอกไฟล์ทั้งหมดตาม artifacts ที่ให้ไว้
```

### 3. รัน Docker Compose
```bash
# Build และรัน services ทั้งหมด
docker-compose up --build

# หรือรันใน background
docker-compose up -d --build
```

### 4. Setup WordPress (ครั้งแรกเท่านั้น)
1. เข้า http://localhost:8080
2. Setup WordPress installation
3. เลือก language และสร้าง admin user
4. เข้า WP Admin และเพิ่ม posts เพื่อทดสอบ

### 5. เข้าใช้งาน React Dashboard
```bash
# เข้า Dashboard
http://localhost:3001

# คลิก "Setup Initial Routes" เพื่อสร้าง routes เริ่มต้น
```

## 🔧 Configuration

### APISIX Routes ที่สร้างอัตโนมัติ:

1. **WordPress API Route**
   - URI: `/api/posts`
   - Upstream: `wordpress:80`
   - Rewrite: `/wp-json/wp/v2/posts`

2. **GoFiber API Route**
   - URI: `/api/data/*`
   - Upstream: `gofiber-backend:3000`
   - Plugins: Key Authentication

## 📡 API Endpoints

### WordPress API (ผ่าน APISIX)
```bash
# Get WordPress posts
GET http://localhost:9080/api/posts

# Get specific post
GET http://localhost:9080/api/posts/1
```

### GoFiber API (ผ่าน APISIX)
```bash
# Get all records
GET http://localhost:9080/api/data

# Create new record
POST http://localhost:9080/api/data
Content-Type: application/json
{
  "name": "Test Record",
  "value": "Test Value"
}

# Get specific record
GET http://localhost:9080/api/data/1

# Update record
PUT http://localhost:9080/api/data/1
Content-Type: application/json
{
  "name": "Updated Name",
  "value": "Updated Value"
}

# Delete record
DELETE http://localhost:9080/api/data/1
```

### Direct GoFiber API (สำหรับทดสอบ)
```bash
# Health check
GET http://localhost:3000/api/health

# Get all data
GET http://localhost:3000/api/data
```

## 🎯 Dashboard Features

### 1. Overview
- สถานะของ services ต่างๆ
- จำนวน routes และ upstreams
- Quick actions สำหรับการจัดการ

### 2. Routes Management
- ดู routes ทั้งหมด
- สร้าง route ใหม่
- ลบ routes
- ดู configuration แบบ JSON

### 3. Create Route
- Form สำหรับสร้าง route ใหม่
- Quick fill templates สำหรับ WordPress และ GoFiber
- การตั้งค่า plugins (CORS, Authentication, Proxy Rewrite)

## 🔒 Security

### API Key Authentication (สำหรับ GoFiber)
```bash
# สร้าง consumer และ API key
curl -X POST http://localhost:9180/apisix/admin/consumers \
  -H 'X-API-KEY: edd1c9f034335f136f87ad84b625c8f1' \
  -d '{
    "username": "test-user",
    "plugins": {
      "key-auth": {
        "key": "test-api-key"
      }
    }
  }'

# ใช้ API key ในการเรียก API
curl -H 'apikey: test-api-key' http://localhost:9080/api/data
```

## 🛠️ Development

### Backend (GoFiber)
```bash
cd backend

# Install dependencies
go mod tidy

# Run locally (ต้องมี MariaDB)
go run main.go
```

### Frontend (React)
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm start

# Build for production
npm run build
```

## 📊 Monitoring

### APISIX Admin API
```bash
# ดู routes ทั้งหมด
curl -X GET http://localhost:9180/apisix/admin/routes \
  -H 'X-API-KEY: edd1c9f034335f136f87ad84b625c8f1'

# ดู upstreams ทั้งหมด
curl -X GET http://localhost:9180/apisix/admin/upstreams \
  -H 'X-API-KEY: edd1c9f034335f136f87ad84b625c8f1'
```

### Database Connection
```bash
# เข้า MariaDB
docker exec -it mariadb mysql -u apisix_user -p
# Password: apisix_pass

# ดูข้อมูลใน database
USE apisix_db;
SHOW TABLES;
SELECT * FROM records;
```

## 🐛 Troubleshooting

### 1. Services ไม่เริ่มต้น
```bash
# ดู logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### 2. APISIX ไม่สามารถเชื่อมต่อ etcd
```bash
# ตรวจสอบ etcd
docker-compose logs etcd

# Restart APISIX
docker-compose restart apisix
```

### 3. Database connection error
```bash
# ตรวจสอบ MariaDB
docker-compose logs mariadb

# ทดสอบการเชื่อมต่อ
docker exec -it mariadb mysql -u root -p
```

### 4. React Dashboard ไม่สามารถเชื่อมต่อ APISIX Admin API
- ตรวจสอบ CORS settings
- ตรวจสอบ Admin Key
- ดู browser console เพื่อหา error

## 📝 API Documentation

### GoFiber Endpoints

#### Health Check
- **GET** `/api/health`
- **Response**: `{ "status": "ok", "message": "GoFiber backend is running", "time": "2024-01-01T00:00:00Z" }`

#### Records CRUD
- **GET** `/api/data` - Get all records
- **POST** `/api/data` - Create record
  ```json
  {
    "name": "Record Name",
    "value": "Record Value"
  }
  ```
- **GET** `/api/data/:id` - Get record by ID
- **PUT** `/api/data/:id` - Update record
- **DELETE** `/api/data/:id` - Delete record

## 🎉 Demo Scenarios

### 1. ทดสอบ WordPress API
```bash
# ผ่าน APISIX
curl http://localhost:9080/api/posts

# Direct access
curl http://localhost:8080/wp-json/wp/v2/posts
```

### 2. ทดสอบ GoFiber API
```bash
# Create record
curl -X POST http://localhost:9080/api/data \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test", "value": "Hello World"}'

# Get all records
curl http://localhost:9080/api/data
```

### 3. ใช้ Dashboard
1. เปิด http://localhost:3001
2. ดู routes ปัจจุบัน
3. สร้าง route ใหม่ด้วย form
4. ทดสอบ API ผ่าน routes ที่สร้าง

## 📚 Learning Resources

- [Apache APISIX Documentation](https://apisix.apache.org/docs/apisix/getting-started/)
- [GoFiber Documentation](https://docs.gofiber.io/)
- [React Documentation](https://reactjs.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).