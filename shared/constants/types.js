/**
 * NFT 스테이킹 프로그램 타입 정의
 * 다양한 상수 값과 열거형을 정의
 */

// NFT 등급 (0-3)
const NFT_TIERS = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3
};

// 스테이킹 기간 (일)
const STAKING_PERIODS = {
  SHORT: 7,      // 7일
  MEDIUM: 30,    // 30일
  LONG: 60,      // 60일
  EXTENDED: 90   // 90일
};

// 소셜 활동 유형
const SOCIAL_ACTIVITY_TYPES = {
  TWITTER: 0,
  TELEGRAM: 1,
  DISCORD: 2
};

// 보상 승수 (100 = 1.0x)
const REWARD_MULTIPLIERS = {
  COMMON: 100,       // 1.0x
  RARE: 200,         // 2.0x
  EPIC: 400,         // 4.0x
  LEGENDARY: 800     // 8.0x
};

// 스테이킹 기간 보너스 (20% 보너스)
const STAKING_PERIOD_BONUS = 20;

// 거버넌스 관련 상수
const GOVERNANCE_CONSTANTS = {
  DEFAULT_VOTING_DELAY: 86400,      // 1일 (초)
  DEFAULT_VOTING_PERIOD: 604800,    // 7일 (초)
  DEFAULT_PROPOSAL_THRESHOLD: 10,   // 제안 생성에 필요한 최소 투표력
  DEFAULT_QUORUM: 100,              // 제안 유효성을 위한 최소 투표수
  DEFAULT_APPROVE_THRESHOLD: 51,    // 통과를 위한 최소 찬성 비율 (51%)
  DEFAULT_TIMELOCK_DELAY: 86400     // 승인 후 1일 타임락
};

// 소셜 활동 관련 상수
const SOCIAL_CONSTANTS = {
  DEFAULT_TWITTER_REWARD: 5,      // 트위터 활동 보상 토큰
  DEFAULT_TELEGRAM_REWARD: 3,     // 텔레그램 활동 보상 토큰
  DEFAULT_DISCORD_REWARD: 4,      // 디스코드 활동 보상 토큰
  DEFAULT_COOLDOWN_PERIOD: 86400, // 보상간 24시간 쿨다운
  DEFAULT_MAX_REWARDS_PER_DAY: 3  // 일일 최대 보상 청구 횟수
};

module.exports = {
  NFT_TIERS,
  STAKING_PERIODS,
  SOCIAL_ACTIVITY_TYPES,
  REWARD_MULTIPLIERS,
  STAKING_PERIOD_BONUS,
  GOVERNANCE_CONSTANTS,
  SOCIAL_CONSTANTS
};