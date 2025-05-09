/**
 * NFT 스테이킹 프로그램 명령어 및 계정 식별자(discriminator)
 * IDL에서 추출된 정확한 식별자 값
 */

// Buffer 의존성
const { Buffer } = require('buffer');

// IDL에서 추출한 명령어 식별자(8바이트)
const INSTRUCTION_DISCRIMINATORS = {
  INITIALIZE: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  STAKE_NFT: Buffer.from([38, 27, 66, 46, 69, 65, 151, 219]),
  UNSTAKE_NFT: Buffer.from([17, 182, 24, 211, 101, 138, 50, 163]),
  INIT_USER_STAKING_INFO: Buffer.from([228, 148, 161, 162, 20, 86, 73, 202]),
  CLAIM_REWARDS: Buffer.from([4, 144, 132, 71, 116, 23, 151, 80]),
  FUND_REWARD_POOL: Buffer.from([85, 49, 108, 245, 204, 70, 243, 3]),
  INITIALIZE_REWARD_POOL: Buffer.from([139, 189, 60, 130, 44, 211, 218, 99]),
  UPDATE_REWARD_RATE: Buffer.from([105, 157, 0, 185, 21, 144, 163, 159]),
  UPDATE_TIER_MULTIPLIERS: Buffer.from([25, 132, 162, 53, 130, 129, 248, 23]),
  UPDATE_REWARD_PARAMS: Buffer.from([146, 73, 176, 37, 49, 138, 89, 174]),
  UPDATE_POOL_SETTINGS: Buffer.from([222, 34, 66, 86, 117, 205, 101, 49]),
  PAUSE_POOL: Buffer.from([160, 15, 12, 189, 160, 0, 243, 245]),
  UNPAUSE_POOL: Buffer.from([241, 148, 129, 243, 222, 125, 125, 160]),
  MIGRATE_STAKE_INFO: Buffer.from([55, 216, 65, 105, 113, 167, 92, 110]),
  MIGRATE_USER_STAKING_INFO: Buffer.from([109, 210, 28, 22, 40, 37, 154, 145])
};

// IDL에서 추출한 계정 식별자(8바이트)
const ACCOUNT_DISCRIMINATORS = {
  POOL_STATE: Buffer.from([247, 237, 227, 245, 215, 195, 222, 70]),
  STAKE_INFO: Buffer.from([66, 62, 68, 70, 108, 179, 183, 235]),
  USER_STAKING_INFO: Buffer.from([171, 19, 114, 117, 157, 103, 21, 106])
};

// IDL에서 추출한 이벤트 식별자(8바이트)
const EVENT_DISCRIMINATORS = {
  NFT_STAKED: Buffer.from([150, 229, 155, 99, 88, 181, 254, 61]),
  NFT_UNSTAKED: Buffer.from([253, 242, 47, 131, 231, 214, 72, 117]),
  REWARDS_CLAIMED: Buffer.from([75, 98, 88, 18, 219, 112, 88, 121]),
  COLLECTION_BONUS_UPDATED: Buffer.from([211, 11, 24, 70, 63, 249, 162, 118])
};

module.exports = {
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_DISCRIMINATORS,
  EVENT_DISCRIMINATORS
};