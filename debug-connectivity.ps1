# PowerShell Debug Script for APISIX Gateway
Write-Host "=== APISIX Gateway Connectivity Debug Script ===" -ForegroundColor Green
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor Gray
Write-Host ""

# ตรวจสอบ containers ที่กำลังรันอยู่
Write-Host "1. Checking running containers..." -ForegroundColor Yellow
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

# ตรวจสอบ network connectivity
Write-Host "2. Checking network connectivity..." -ForegroundColor Yellow
Write-Host "Network: gateway-net"
docker network inspect gateway-net --format '{{json .Containers}}'
Write-Host ""

# ตรวจสอบ APISIX logs
Write-Host "3. Checking APISIX logs (last 20 lines)..." -ForegroundColor Yellow
docker logs apisix_api --tail 20
Write-Host ""

# ทดสอบ internal connectivity จาก APISIX container
Write-Host "4. Testing internal connectivity from APISIX..." -ForegroundColor Yellow
Write-Host "Testing GoFiber backend:"
try {
    docker exec apisix_api curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" http://gofiber-backend:3000/api/health
} catch {
    Write-Host "Failed to connect to GoFiber" -ForegroundColor Red
}

Write-Host "Testing WordPress:"
try {
    docker exec apisix_api curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" http://wordpress/wp-json/wp/v2/posts
} catch {
    Write-Host "Failed to connect to WordPress" -ForegroundColor Red
}

Write-Host "Testing WordPress root:"
try {
    docker exec apisix_api curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" http://wordpress/
} catch {
    Write-Host "Failed to connect to WordPress root" -ForegroundColor Red
}
Write-Host ""

# ทดสอบ external access
Write-Host "5. Testing external access..." -ForegroundColor Yellow
Write-Host "Testing APISIX gateway (port 9080):"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9080/api/health" -Method GET -TimeoutSec 10
    Write-Host "HTTP $($response.StatusCode) - Success" -ForegroundColor Green
} catch {
    Write-Host "Failed to connect to APISIX gateway: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Testing WordPress direct (port 8080):"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/wp-json/wp/v2/posts" -Method GET -TimeoutSec 10
    Write-Host "HTTP $($response.StatusCode) - Success" -ForegroundColor Green
} catch {
    Write-Host "Failed to connect to WordPress direct: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Testing GoFiber direct (port 3000):"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET -TimeoutSec 10
    Write-Host "HTTP $($response.StatusCode) - Success" -ForegroundColor Green
} catch {
    Write-Host "Failed to connect to GoFiber direct: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ตรวจสอบ APISIX routes
Write-Host "6. Testing APISIX routes..." -ForegroundColor Yellow
Write-Host "Testing /api/health through APISIX:"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9080/api/health" -Method GET -TimeoutSec 10
    Write-Host "HTTP $($response.StatusCode)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Testing /api/posts through APISIX:"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9080/api/posts" -Method GET -TimeoutSec 10
    Write-Host "HTTP $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content.Length -lt 500) {
        Write-Host $response.Content
    } else {
        Write-Host "Response length: $($response.Content.Length) characters"
    }
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Testing /api/data through APISIX:"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9080/api/data" -Method GET -TimeoutSec 10
    Write-Host "HTTP $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content.Length -lt 500) {
        Write-Host $response.Content
    } else {
        Write-Host "Response length: $($response.Content.Length) characters"
    }
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ตรวจสอบ APISIX configuration
Write-Host "7. Checking APISIX configuration..." -ForegroundColor Yellow
Write-Host "Config file:"
docker exec apisix_api cat /usr/local/apisix/conf/config.yaml

Write-Host ""
Write-Host "Routes file:"
docker exec apisix_api cat /usr/local/apisix/conf/apisix.yaml
Write-Host ""

# ตรวจสอบ WordPress REST API
Write-Host "8. Checking WordPress REST API..." -ForegroundColor Yellow
Write-Host "WordPress REST API discovery:"
try {
    docker exec wordpress curl -s http://localhost/wp-json/
} catch {
    Write-Host "WordPress REST API not responding" -ForegroundColor Red
}
Write-Host ""

# ตรวจสอบ GoFiber health
Write-Host "9. Checking GoFiber backend..." -ForegroundColor Yellow
Write-Host "GoFiber health check:"
try {
    docker exec gofiber-backend curl -s http://localhost:3000/api/health
} catch {
    Write-Host "GoFiber health check failed" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Debug completed ===" -ForegroundColor Green
Write-Host "If you see errors above, please check:" -ForegroundColor Yellow
Write-Host "1. All containers are running and healthy" -ForegroundColor White
Write-Host "2. Network configuration is correct" -ForegroundColor White
Write-Host "3. APISIX configuration files are mounted properly" -ForegroundColor White
Write-Host "4. Services are listening on correct ports" -ForegroundColor White