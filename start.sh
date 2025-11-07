#!/bin/bash

# IM MVP 项目启动脚本
# 使用方法: ./start.sh [dev|prod|stop|restart|logs]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

    # 停止现有服务
    docker compose down || true

    # 启动MySQL和Redis
    log_info "Starting MySQL and Redis..."
    docker compose up -d mysql redis

    # 等待数据库就绪
    log_info "Waiting for databases to be ready..."
    sleep 10

    # 执行数据库初始化 (重试直到成功)
    log_info "Initializing database..."
    max_retries=10
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

    # 构建后端
    log_step "Building Go server..."
    cd server

    # 添加必要的Go依赖
    go mod tidy

    # 下载依赖
    go mod download

    # 启动后端
    log_info "Starting Go server..."
    go run main.go &
    echo $! > ../server.pid

    cd ..

    # 等待后端启动
    sleep 3

    log_info "Development environment started"
    log_info "API endpoints:"
    log_info "  Health: http://localhost:8080/api/v1/health"
    log_info "  WebSocket: ws://localhost:8080/ws"
    log_info ""
    log_info "To start frontend, run: cd web && npm start"
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

    # 停止Docker服务
    docker compose --profile frontend down || true

    # 停止Go进程
    if [ -f "./server.pid" ]; then
        PID=$(cat ./server.pid)
        if ps -p "$PID" > /dev/null; then
            log_info "Stopping Go server (PID: $PID)..."
            kill "$PID"
            rm -f ./server.pid
        fi
    fi

    log_info "All services stopped"
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
    echo "IM MVP 项目启动脚本"
    echo ""
    echo "使用方法:"
    echo "  ./start.sh [command]"
    echo ""
    echo "可用命令:"
    echo "  dev      启动开发环境(后端Go程序 + MySQL + Redis)"
    echo "  prod     启动生产环境(Docker容器化)"
    echo "  full     启动完整环境(包含前端)"
    echo "  stop     停止所有服务"
    echo "  restart  重启服务"
    echo "  logs     查看日志"
    echo "  init     初始化项目"
    echo "  help     显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./start.sh dev      # 启动开发环境"
    echo "  ./start.sh prod     # 启动生产环境"
    echo "  ./start.sh full     # 启动包含前端的生产环境"
    echo "  ./start.sh logs     # 查看服务日志"
    echo "  ./start.sh stop     # 停止所有服务"
}

# 主函数
main() {
    case "${1:-help}" in
        "dev")
            check_dependencies
            init_project
            start_dev
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
        "logs")
            show_logs
            ;;
        "init")
            init_project
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

main "$@"
