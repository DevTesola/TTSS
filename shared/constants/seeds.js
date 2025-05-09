/**
 * NFT 스테이킹 프로그램 PDA 시드 값
 * Solana 프로그램 주소 파생(PDA) 생성에 사용되는 시드 값들
 */

// Buffer를 사용하여 PDA 시드를 바이트 배열로 정의
const { Buffer } = require('buffer');

// PDA Seeds
const POOL_SEED = Buffer.from("pool_state"); // 풀 상태 계정 시드 (정확한 값)
const STAKE_SEED = Buffer.from([115, 116, 97, 107, 101]); // "stake"
const ESCROW_SEED = Buffer.from([101, 115, 99, 114, 111, 119]); // "escrow"
const USER_STAKING_SEED = Buffer.from([117, 115, 101, 114, 95, 115, 116, 97, 107, 105, 110, 103]); // "user_staking"
const SOCIAL_SEED = Buffer.from([115, 111, 99, 105, 97, 108]); // "social"
const PROOF_SEED = Buffer.from([112, 114, 111, 111, 102]); // "proof"
const VOTE_SEED = Buffer.from([118, 111, 116, 101]); // "vote"
const REWARD_VAULT_AUTHORITY_SEED = Buffer.from("reward_vault_authority");

// 시드 문자열 (디버깅 및 참조용)
const SEED_STRINGS = {
  POOL_SEED_STR: "pool_state",
  STAKE_SEED_STR: "stake",
  ESCROW_SEED_STR: "escrow",
  USER_STAKING_SEED_STR: "user_staking",
  SOCIAL_SEED_STR: "social",
  PROOF_SEED_STR: "proof",
  VOTE_SEED_STR: "vote",
  REWARD_VAULT_AUTHORITY_SEED_STR: "reward_vault_authority"
};

module.exports = {
  POOL_SEED,
  STAKE_SEED,
  ESCROW_SEED,
  USER_STAKING_SEED,
  SOCIAL_SEED,
  PROOF_SEED,
  VOTE_SEED,
  REWARD_VAULT_AUTHORITY_SEED,
  SEED_STRINGS
};