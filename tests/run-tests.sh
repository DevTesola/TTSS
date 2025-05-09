#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 스크립트 경로 설정
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")

echo -e "${BLUE}===== 스테이킹 API 테스트 실행 =====${NC}"
echo -e "${YELLOW}프로젝트 디렉토리:${NC} $PROJECT_DIR"
echo -e "${YELLOW}테스트 디렉토리:${NC} $SCRIPT_DIR"

# 다음 포트 사용 중인지 확인
check_port() {
  port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}포트 $port가 이미 사용 중입니다. 다른 포트를 사용하세요.${NC}"
    return 1
  fi
  return 0
}

# Next.js 개발 서버 시작
start_server() {
  PORT=$1
  echo -e "${YELLOW}Next.js 개발 서버 시작 중 (포트 $PORT)...${NC}"
  PORT=$PORT npm --prefix "$PROJECT_DIR" run dev &
  SERVER_PID=$!
  
  # 서버가 시작될 때까지 대기
  echo -n "서버 시작 대기 중 "
  MAX_WAIT=30
  for i in $(seq 1 $MAX_WAIT); do
    if curl -s http://localhost:$PORT > /dev/null; then
      echo -e "\n${GREEN}서버가 시작되었습니다!${NC}"
      break
    fi
    echo -n "."
    sleep 1
    
    if [ $i -eq $MAX_WAIT ]; then
      echo -e "\n${RED}서버가 $MAX_WAIT초 내에 시작되지 않았습니다.${NC}"
      kill $SERVER_PID 2>/dev/null
      exit 1
    fi
  done
  
  return 0
}

# 테스트 실행
run_test() {
  TEST_NAME=$1
  echo -e "${BLUE}\n===== 테스트 실행: $TEST_NAME =====${NC}"
  
  node "$SCRIPT_DIR/$TEST_NAME"
  TEST_EXIT=$?
  
  if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}테스트 성공!${NC}"
  else
    echo -e "${RED}테스트 실패! (종료 코드: $TEST_EXIT)${NC}"
    FAILED_TESTS=1
  fi
  
  return $TEST_EXIT
}

# Cleanup function
cleanup() {
  echo -e "${YELLOW}\n서버 중지 중...${NC}"
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
  fi
  
  echo -e "${GREEN}테스트 완료!${NC}"
  exit $FAILED_TESTS
}

# SIGINT, SIGTERM 시그널에 대한 핸들러 등록
trap cleanup SIGINT SIGTERM

PORT=3000
FAILED_TESTS=0

# 포트 사용 가능 확인
check_port $PORT || exit 1

# 서버 시작
start_server $PORT || exit 1

# 테스트 실행
run_test "claim-rewards-test.js"

# 서버 중지 및 종료
cleanup