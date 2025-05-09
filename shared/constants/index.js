/**
 * 중앙화된 상수 모듈 진입점
 * 모든 상수 파일을 가져와서 다시 내보냅니다
 */

const programIds = require('./program-ids');
const seeds = require('./seeds');
const discriminators = require('./discriminators');
const types = require('./types');

// 모든 상수를 가져와서 하나의 객체로 통합
module.exports = {
  // 프로그램 ID와 주소
  ...programIds,
  
  // PDA 시드 값
  ...seeds,
  
  // 명령어 및 계정 식별자
  ...discriminators,
  
  // 타입 정의
  ...types
};