/**
 * 명령어 데이터 생성 유틸리티 함수
 * IDL 기반의 명령어 데이터를 일관된 방식으로 생성합니다.
 */

import { DISCRIMINATORS } from './constants';

/**
 * 명령어 데이터 생성 함수
 * @param {string} instructionName - 명령어 이름 (예: 'STAKE_NFT', 'UNSTAKE_NFT', 'CLAIM_REWARDS' 등)
 * @param {Array} args - 명령어 인자 배열 (Buffer 객체 배열)
 * @returns {Buffer} 명령어 데이터 버퍼
 */
export function createInstructionData(instructionName, args = []) {
  // 명령어 discriminator 가져오기
  const discriminator = DISCRIMINATORS[instructionName];
  
  if (!discriminator) {
    throw new Error(`Unknown instruction name: ${instructionName}`);
  }
  
  // discriminator만 있는 경우 (인자 없음)
  if (args.length === 0) {
    return Buffer.from(discriminator);
  }
  
  // discriminator와 인자들을 연결
  return Buffer.concat([Buffer.from(discriminator), ...args]);
}

/**
 * u64 값을 8바이트 Buffer로 변환 (little-endian)
 * @param {number|bigint} value - 변환할 숫자 값
 * @returns {Buffer} 8바이트 버퍼
 */
export function serializeU64(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

/**
 * u32 값을 4바이트 Buffer로 변환 (little-endian)
 * @param {number} value - 변환할 숫자 값
 * @returns {Buffer} 4바이트 버퍼
 */
export function serializeU32(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

/**
 * u8 값을 1바이트 Buffer로 변환
 * @param {number} value - 변환할 숫자 값 (0-255)
 * @returns {Buffer} 1바이트 버퍼
 */
export function serializeU8(value) {
  return Buffer.from([value & 0xff]);
}

/**
 * boolean 값을 1바이트 Buffer로 변환 (0 또는 1)
 * @param {boolean} value - 변환할 불리언 값
 * @returns {Buffer} 1바이트 버퍼
 */
export function serializeBoolean(value) {
  return Buffer.from([value ? 1 : 0]);
}

/**
 * NFT 등급 값을 u8로 변환
 * @param {string} tier - NFT 등급 문자열 ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')
 * @returns {Buffer} 1바이트 버퍼
 */
export function serializeNftTier(tier) {
  const tierMap = {
    'COMMON': 0,
    'RARE': 1,
    'EPIC': 2,
    'LEGENDARY': 3
  };
  
  const tierValue = tierMap[tier.toUpperCase()] ?? 0;
  return serializeU8(tierValue);
}

/**
 * stake_nft 명령어 데이터 생성 헬퍼 함수
 * @param {number} stakingPeriod - 스테이킹 기간 (일)
 * @param {string|number} nftTier - NFT 등급 (문자열 또는 숫자)
 * @param {boolean} autoCompound - 자동 복리 여부
 * @returns {Buffer} 명령어 데이터 버퍼
 */
export function createStakeNftInstructionData(stakingPeriod, nftTier, autoCompound = false) {
  // 문자열 tier를 숫자로 변환
  let tierValue = nftTier;
  if (typeof nftTier === 'string') {
    tierValue = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].indexOf(nftTier.toUpperCase());
    if (tierValue === -1) tierValue = 0; // 기본값 COMMON
  }
  
  return createInstructionData('STAKE_NFT', [
    serializeU64(stakingPeriod),
    serializeU8(tierValue),
    serializeBoolean(autoCompound)
  ]);
}

/**
 * unstake_nft 명령어 데이터 생성 헬퍼 함수 (인자 없음)
 * @returns {Buffer} 명령어 데이터 버퍼
 */
export function createUnstakeNftInstructionData() {
  return createInstructionData('UNSTAKE_NFT');
}

/**
 * claim_rewards 명령어 데이터 생성 헬퍼 함수 (인자 없음)
 * @returns {Buffer} 명령어 데이터 버퍼
 */
export function createClaimRewardsInstructionData() {
  return createInstructionData('CLAIM_REWARDS');
}

/**
 * init_user_staking_info 명령어 데이터 생성 헬퍼 함수 (인자 없음)
 * @returns {Buffer} 명령어 데이터 버퍼
 */
export function createInitUserStakingInfoInstructionData() {
  return createInstructionData('INIT_USER_STAKING_INFO');
}