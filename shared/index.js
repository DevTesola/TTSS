/**
 * 중앙화된 공통 모듈 메인 진입점
 * 모든 상수와 유틸리티 함수를 단일 지점에서 내보냅니다
 */

const constants = require('./constants');
const utils = require('./utils');

/**
 * 공통 모듈 버전 정보
 */
const VERSION = '1.0.0';

/**
 * 공통 모듈 메타데이터
 */
const META = {
  version: VERSION,
  description: 'TESOLA NFT Staking Common Module',
  author: 'TESOLA Dev Team',
  createdAt: '2025-05-10',
  programId: constants.PROGRAM_ID
};

/**
 * 모든 상수와 유틸리티를 통합 내보내기
 */
module.exports = {
  // 메타데이터
  VERSION,
  META,
  
  // 상수
  ...constants,
  
  // 유틸리티
  ...utils
};