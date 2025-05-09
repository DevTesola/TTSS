/**
 * api-test-helpers.js - API 테스트를 위한 유틸리티 함수들
 */

const fetch = require('node-fetch');

// 색상 코드 (콘솔 출력용)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * API 요청 유틸리티 함수
 * @param {string} baseUrl - API 기본 URL
 * @param {string} endpoint - API 엔드포인트 경로
 * @param {Object} data - 요청 데이터
 * @param {Object} options - 추가 옵션
 * @param {number} options.timeout - 요청 타임아웃 (ms)
 * @returns {Promise<Object>} 응답 데이터
 */
async function callApi(baseUrl, endpoint, data = {}, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const timeout = options.timeout || 30000; // 기본 30초 타임아웃
  
  console.log(`${colors.cyan}[API 요청]${colors.reset} ${url}`);
  console.log(`${colors.cyan}[데이터]${colors.reset}`, JSON.stringify(data, null, 2));
  
  // 타임아웃 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId); // 타임아웃 해제
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.log(`${colors.red}[API 오류]${colors.reset} 상태 코드: ${response.status}`);
      console.log(responseData);
      throw new Error(`API 오류: ${responseData.error || '알 수 없는 오류'}`);
    }
    
    console.log(`${colors.green}[API 성공]${colors.reset} 상태 코드: ${response.status}`);
    return responseData;
  } catch (error) {
    clearTimeout(timeoutId); // 타임아웃 해제
    
    if (error.name === 'AbortError') {
      console.log(`${colors.red}[API 타임아웃]${colors.reset} ${timeout}ms 후 요청이 중단됨`);
      throw new Error(`API 요청 타임아웃 (${timeout}ms)`);
    }
    
    console.log(`${colors.red}[API 예외]${colors.reset} ${error.message}`);
    throw error;
  }
}

/**
 * 지정된 시간만큼 대기
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 간단한 검증 도구
 */
const assert = {
  /**
   * 조건이 참인지 검증
   * @param {boolean} condition - 검증할 조건
   * @param {string} message - 실패 시 메시지
   */
  isTrue: (condition, message) => {
    if (!condition) {
      console.log(`${colors.red}[검증 실패]${colors.reset} ${message}`);
      throw new Error(message);
    }
    console.log(`${colors.green}[검증 통과]${colors.reset} ${message}`);
  },
  
  /**
   * 두 값이 동일한지 검증
   * @param {any} actual - 실제 값
   * @param {any} expected - 기대하는 값
   * @param {string} message - 실패 시 메시지
   */
  equal: (actual, expected, message) => {
    if (actual !== expected) {
      console.log(`${colors.red}[검증 실패]${colors.reset} ${message}`);
      console.log(`  기대: ${expected}`);
      console.log(`  실제: ${actual}`);
      throw new Error(message);
    }
    console.log(`${colors.green}[검증 통과]${colors.reset} ${message}`);
  },
  
  /**
   * 객체에 특정 속성이 있는지 검증
   * @param {Object} obj - 검증할 객체
   * @param {string} prop - 검증할 속성 이름
   * @param {string} message - 실패 시 메시지
   */
  hasProperty: (obj, prop, message) => {
    if (!obj || !obj.hasOwnProperty(prop)) {
      console.log(`${colors.red}[검증 실패]${colors.reset} ${message}`);
      console.log(`  객체에 '${prop}' 속성이 없습니다`);
      throw new Error(message);
    }
    console.log(`${colors.green}[검증 통과]${colors.reset} ${message}`);
  }
};

module.exports = {
  colors,
  callApi,
  sleep,
  assert
};