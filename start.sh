#!/bin/bash

# GoChat 项目启动脚本
# 使用方法: ./start.sh [dev|devfull|prod|full|stop|restart|status|logs]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# PID 文件
GO_PID_FILE="$PROJECT_ROOT/.gochat.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/.frontend.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_status() {
    echo -e "${CYAN}[STATUS]${NC} $1"
}

# 检查进程是否运行
is_process_running() {
    local pid=$1
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# 获取保存的 PID
get_saved_pid() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        cat "$pid_file"
    fi
}

# 查找运行中的 Go 服务进程
find_go_processes() {
    pgrep -f "go run main.go" 2>/dev/null || true
    pgrep -f "go-build.*main" 2>/dev/null || true
}

# 查找运行中的前端进程
find_frontend_processes() {
    pgrep -f "react-scripts start" 2>/dev/null || true
    pgrep -f "node.*web/node_modules" 2>/dev/null || true
}

# 检查依赖
check_dependencies() {
    # 检查docker
    if ! command -v "docker" &> /dev/null; then
        log_error "docker is not installed. Please install it first."
        exit 1
    fi

    # 检查docker compose（新版本命令）
    if command -v "docker-compose" &> /dev/null; then
        log_info "Using docker-compose"
    elif docker compose version &> /dev/null; then
        log_info "Using docker compose"
    else
        log_error "docker compose (or docker-compose) is not installed. Please install it first."
        exit 1
    fi

    log_info "Dependencies check passed"
}

# 初始化项目
init_project() {
    log_step "Initializing project..."

    # 检查Go项目依赖
    if [ -f "server/go.mod" ]; then
        log_info "Go module already initialized"
    else
        log_warn "Go module not found. Initializing..."
        cd server
        go mod init gochat
        go mod tidy
        cd ..
    fi

    log_info "Project initialized successfully"
}

# 启动开发环境
start_dev() {
    log_step "Starting development environment..."

    # 先停止可能存在的服务
    stop_go_server

    # 停止现有 Docker 服务
    docker compose down 2>/dev/null || true

    # 启动MySQL和Redis
    log_info "Starting MySQL and Redis..."
    docker compose up -d mysql redis

    # 等待数据库就绪
    log_info "Waiting for databases to be ready..."
    sleep 5

    # 执行数据库初始化 (重试直到成功)
    log_info "Initializing database..."
    max_retries=15
    retry_count=0
    while true; do
        if docker compose exec -T mysql mysql -h mysql -uroot -proot123 im_db < scripts/init.sql 2>/dev/null; then
            log_info "Database initialized successfully"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -ge $max_retries ]; then
                log_error "Failed to initialize database after $max_retries attempts"
                exit 1
            fi
            log_warn "Database not ready, retrying in 2 seconds... ($retry_count/$max_retries)"
            sleep 2
        fi
    done

    # 启动后端
    start_go_server

    log_info ""
    log_info "Development environment started successfully!"
    log_info "API endpoints:"
    log_info "  Health: http://localhost:8080/api/v1/health"
    log_info "  WebSocket: ws://localhost:8080/ws"
    log_info ""
    log_info "To start frontend, run: ./start.sh devfull"
}

# 启动 Go 服务
start_go_server() {
    log_step "Starting Go server..."

    cd "$PROJECT_ROOT/server"

    # 确保日志目录存在
    mkdir -p "$PROJECT_ROOT/server/logs"

    # 添加必要的Go依赖
    go mod tidy

    # 下载依赖
    go mod download

    # 启动后端
    log_info "Launching Go server in background..."
    nohup go run main.go > "$PROJECT_ROOT/server/logs/server.out" 2>&1 &
    GO_PID=$!
    echo $GO_PID > "$GO_PID_FILE"
    cd "$PROJECT_ROOT"

    # 等待并检查后端是否启动成功
    log_info "Waiting for Go server to start..."
    max_retries=20
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        # 检查进程是否还在运行
        if ! is_process_running "$GO_PID"; then
            log_error "Go server process has exited unexpectedly"
            if [ -f "server/logs/gochat.log" ]; then
                log_error "Last few lines from log file:"
                tail -n 10 server/logs/gochat.log
            fi
            rm -f "$GO_PID_FILE"
            exit 1
        fi

        # 检查健康检查端点
        if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
            log_info "Go server is running (PID: $GO_PID)"
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -ge $max_retries ]; then
            log_error "Go server failed to start after ${max_retries} attempts"
            log_error "Process ID: $GO_PID"
            if [ -f "server/logs/gochat.log" ]; then
                log_error "Last few lines from log file:"
                tail -n 10 server/logs/gochat.log
            fi
            kill "$GO_PID" 2>/dev/null || true
            rm -f "$GO_PID_FILE"
            exit 1
        fi

        log_info "Waiting for server to be ready... ($retry_count/$max_retries)"
        sleep 2
    done
}

# 停止 Go 服务
stop_go_server() {
    log_info "Stopping Go server..."

    # 从 PID 文件停止
    local saved_pid=$(get_saved_pid "$GO_PID_FILE")
    if [ -n "$saved_pid" ] && is_process_running "$saved_pid"; then
        log_info "Stopping Go server (PID: $saved_pid)..."
        kill "$saved_pid" 2>/dev/null || true
        sleep 1
    fi
    rm -f "$GO_PID_FILE"

    # 查找并停止所有相关进程
    local go_pids=$(find_go_processes)
    if [ -n "$go_pids" ]; then
        log_info "Stopping remaining Go processes..."
        echo "$go_pids" | xargs -r kill 2>/dev/null || true
        sleep 1
    fi
}

# 启动前端
start_frontend() {
    log_step "Starting frontend development server..."

    cd "$PROJECT_ROOT/web"

    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm install
    fi

    # 启动前端
    log_info "Launching frontend in background..."
    nohup npm start > "$PROJECT_ROOT/web/frontend.out" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$FRONTEND_PID_FILE"
    cd "$PROJECT_ROOT"

    # 等待前端启动
    log_info "Waiting for frontend to start..."
    max_retries=30
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_info "Frontend is running (PID: $FRONTEND_PID)"
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -ge $max_retries ]; then
            log_warn "Frontend may still be starting up. Check http://localhost:3000"
            return 0
        fi

        sleep 2
    done
}

# 停止前端
stop_frontend() {
    log_info "Stopping frontend..."

    # 从 PID 文件停止
    local saved_pid=$(get_saved_pid "$FRONTEND_PID_FILE")
    if [ -n "$saved_pid" ] && is_process_running "$saved_pid"; then
        log_info "Stopping frontend (PID: $saved_pid)..."
        kill "$saved_pid" 2>/dev/null || true
        sleep 1
    fi
    rm -f "$FRONTEND_PID_FILE"

    # 查找并停止所有相关进程
    local frontend_pids=$(find_frontend_processes)
    if [ -n "$frontend_pids" ]; then
        log_info "Stopping remaining frontend processes..."
        echo "$frontend_pids" | xargs -r kill 2>/dev/null || true
        sleep 1
    fi
}

# 一键启动完整开发环境
start_dev_full() {
    log_step "Starting full development environment (backend + frontend)..."

    # 启动后端开发环境
    start_dev

    # 启动前端
    start_frontend

    log_info ""
    log_info "========================================="
    log_info "Full development environment is running!"
    log_info "========================================="
    log_info "Frontend: http://localhost:3000"
    log_info "Backend:  http://localhost:8080"
    log_info "Health:   http://localhost:8080/api/v1/health"
    log_info ""
    log_info "To stop all services: ./start.sh stop"
    log_info "To view status: ./start.sh status"
}

# 启动生产环境
start_prod() {
    log_step "Starting production environment..."

    # 停止现有服务
    docker compose down || true

    # 启动所有服务
    log_info "Starting all services with Docker Compose..."
    docker compose up -d mysql redis gochat

    log_info "Production environment started"
    log_info "API endpoints:"
    log_info "  API: http://localhost:8080"
    log_info "  Health: http://localhost:8080/api/v1/health"
    log_info "  WebSocket: ws://localhost:8080/ws"
    log_info ""
    log_info "To include frontend, run: docker compose --profile frontend up -d"
}

# 启动包含前端的生产环境
start_full() {
    log_step "Starting full production environment with frontend..."

    # 停止现有服务
    docker compose --profile frontend down || true

    # 启动所有服务（包括前端）
    log_info "Starting all services including frontend..."
    docker compose --profile frontend up -d

    log_info "Full production environment started"
    log_info "Frontend: http://localhost:3000"
    log_info "API: http://localhost:8080"
    log_info "Health: http://localhost:8080/api/v1/health"
}

# 停止服务
stop_services() {
    log_step "Stopping all services..."

    # 停止前端
    stop_frontend

    # 停止Go服务
    stop_go_server

    # 停止Docker服务
    log_info "Stopping Docker containers..."
    docker compose --profile frontend down 2>/dev/null || true

    # 清理旧的 PID 文件
    rm -f "$PROJECT_ROOT/server.pid" 2>/dev/null || true

    log_info ""
    log_info "All services stopped successfully!"
}

# 查看服务状态
show_status() {
    log_step "Checking service status..."
    echo ""

    # 检查 Go 服务
    local go_pid=$(get_saved_pid "$GO_PID_FILE")
    if [ -n "$go_pid" ] && is_process_running "$go_pid"; then
        log_status "Go Server:    ${GREEN}Running${NC} (PID: $go_pid)"
        if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
            log_status "  API Health: ${GREEN}OK${NC} (http://localhost:8080)"
        else
            log_status "  API Health: ${YELLOW}Not responding${NC}"
        fi
    else
        # 检查是否有其他 Go 进程
        local other_go=$(find_go_processes | head -1)
        if [ -n "$other_go" ]; then
            log_status "Go Server:    ${YELLOW}Running (untracked)${NC} (PID: $other_go)"
        else
            log_status "Go Server:    ${RED}Stopped${NC}"
        fi
    fi

    # 检查前端
    local frontend_pid=$(get_saved_pid "$FRONTEND_PID_FILE")
    if [ -n "$frontend_pid" ] && is_process_running "$frontend_pid"; then
        log_status "Frontend:     ${GREEN}Running${NC} (PID: $frontend_pid)"
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_status "  Web UI:     ${GREEN}OK${NC} (http://localhost:3000)"
        else
            log_status "  Web UI:     ${YELLOW}Starting...${NC}"
        fi
    else
        local other_frontend=$(find_frontend_processes | head -1)
        if [ -n "$other_frontend" ]; then
            log_status "Frontend:     ${YELLOW}Running (untracked)${NC} (PID: $other_frontend)"
        else
            log_status "Frontend:     ${RED}Stopped${NC}"
        fi
    fi

    # 检查 Docker 容器
    echo ""
    log_status "Docker Containers:"

    # MySQL
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gochat-mysql"; then
        log_status "  MySQL:      ${GREEN}Running${NC}"
    else
        log_status "  MySQL:      ${RED}Stopped${NC}"
    fi

    # Redis
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gochat-redis"; then
        log_status "  Redis:      ${GREEN}Running${NC}"
    else
        log_status "  Redis:      ${RED}Stopped${NC}"
    fi

    # gochat container (生产环境)
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^gochat$"; then
        log_status "  GoChat:     ${GREEN}Running${NC} (Docker)"
    fi

    echo ""
}

# 重启服务
restart_services() {
    log_step "Restarting services..."
    stop_services
    sleep 2
    start_prod
}

# 查看日志
show_logs() {
    log_info "Showing logs..."
    docker compose logs -f --tail=100
}

# 显示帮助信息
show_help() {
    echo ""
    echo -e "${BLUE}GoChat 项目启动脚本${NC}"
    echo ""
    echo "使用方法:"
    echo "  ./start.sh [command]"
    echo ""
    echo -e "${GREEN}开发环境命令:${NC}"
    echo "  dev       启动后端开发环境 (Go + MySQL + Redis)"
    echo "  devfull   一键启动完整开发环境 (前端 + 后端 + 数据库)"
    echo ""
    echo -e "${GREEN}生产环境命令:${NC}"
    echo "  prod      启动生产环境 (Docker 容器化后端)"
    echo "  full      启动完整生产环境 (包含前端)"
    echo ""
    echo -e "${GREEN}管理命令:${NC}"
    echo "  stop      一键停止所有服务"
    echo "  restart   重启服务"
    echo "  status    查看所有服务状态"
    echo "  logs      查看 Docker 日志"
    echo "  init      初始化项目"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo -e "  ${CYAN}./start.sh devfull${NC}   # 一键启动完整开发环境"
    echo -e "  ${CYAN}./start.sh stop${NC}      # 一键停止所有服务"
    echo -e "  ${CYAN}./start.sh status${NC}    # 查看服务运行状态"
    echo ""
}

# 主函数
main() {
    case "${1:-help}" in
        "dev")
            check_dependencies
            init_project
            start_dev
            ;;
        "devfull")
            check_dependencies
            init_project
            start_dev_full
            ;;
        "prod")
            check_dependencies
            init_project
            start_prod
            ;;
        "full")
            check_dependencies
            init_project
            start_full
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "init")
            init_project
            ;;
        "help")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
