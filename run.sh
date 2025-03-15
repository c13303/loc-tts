#!/bin/bash

# Configuration
SERVER_DIR="$(dirname "$(readlink -f "$0")")"  # Get the directory where this script is located
SERVER_FILE="$SERVER_DIR/server.js"  # Assuming your Express server file is named server.js
LOG_FILE="$SERVER_DIR/tts-server.log"
PID_FILE="$SERVER_DIR/tts-server.pid"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null; then
            return 0  # Running
        else
            # PID file exists but process is not running
            rm "$PID_FILE" 2>/dev/null
        fi
    fi
    return 1  # Not running
}

# Function to start the server
start_server() {
    echo -e "${YELLOW}Starting TTS server...${NC}"
    cd "$SERVER_DIR" || { echo -e "${RED}Cannot change to server directory $SERVER_DIR${NC}"; exit 1; }
    
    if is_running; then
        echo -e "${RED}Server is already running with PID $(cat "$PID_FILE")${NC}"
        return 1
    fi
    
    # Start the server with nohup and save the PID
    nohup node "$SERVER_FILE" > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    # Give it a moment to start up
    sleep 2
    
    if is_running; then
        echo -e "${GREEN}Server started successfully with PID $PID${NC}"
        echo -e "${GREEN}Logs are being written to $LOG_FILE${NC}"
        return 0
    else
        echo -e "${RED}Server failed to start. Check $LOG_FILE for details.${NC}"
        return 1
    fi
}

# Function to stop the server
stop_server() {
    echo -e "${YELLOW}Stopping TTS server...${NC}"
    
    if ! is_running; then
        echo -e "${RED}Server is not running${NC}"
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null
    
    # Wait for process to end
    COUNTER=0
    while [ $COUNTER -lt 10 ] && is_running; do
        echo -e "${YELLOW}Waiting for server to stop...${NC}"
        sleep 1
        COUNTER=$((COUNTER+1))
    done
    
    if is_running; then
        echo -e "${YELLOW}Forcing server to stop...${NC}"
        kill -9 "$PID" 2>/dev/null
        sleep 1
    fi
    
    if ! is_running; then
        echo -e "${GREEN}Server stopped successfully${NC}"
        rm "$PID_FILE" 2>/dev/null
        return 0
    else
        echo -e "${RED}Failed to stop server${NC}"
        return 1
    fi
}

# Function to restart the server
restart_server() {
    echo -e "${YELLOW}Restarting TTS server...${NC}"
    
    if is_running; then
        stop_server
    fi
    
    start_server
}

# Function to check server status
server_status() {
    if is_running; then
        echo -e "${GREEN}TTS server is running with PID $(cat "$PID_FILE")${NC}"
        echo -e "${GREEN}Log file: $LOG_FILE${NC}"
    else
        echo -e "${RED}TTS server is not running${NC}"
    fi
}

# Function to view logs
view_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -n "${1:-50}" "$LOG_FILE"
    else
        echo -e "${RED}Log file not found${NC}"
    fi
}

# Check command line arguments
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        server_status
        ;;
    logs)
        view_logs "$2"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [lines]}"
        echo ""
        echo "  start    Start the TTS server in nohup mode"
        echo "  stop     Stop the TTS server"
        echo "  restart  Restart the TTS server"
        echo "  status   Check if the TTS server is running"
        echo "  logs     View the last lines of the server log (default: 50 lines)"
        exit 1
        ;;
esac

exit 0