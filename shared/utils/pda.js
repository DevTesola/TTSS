/**
 * Solana 프로그램 파생 주소(PDA) 생성 유틸리티
 */

const { PublicKey } = require('@solana/web3.js');
const { PROGRAM_ID } = require('../constants/program-ids');
const {
  POOL_SEED,
  STAKE_SEED,
  ESCROW_SEED,
  USER_STAKING_SEED,
  SOCIAL_SEED,
  PROOF_SEED,
  VOTE_SEED,
  REWARD_VAULT_AUTHORITY_SEED
} = require('../constants/seeds');

/**
 * 풀 상태 PDA 생성
 * 
 * @returns {[PublicKey, number]} 풀 상태 PDA 및 범프 값
 */
function findPoolStatePDA() {
  return PublicKey.findProgramAddressSync(
    [POOL_SEED],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 스테이크 정보 PDA 생성
 * 
 * @param {PublicKey|string} nftMint - NFT 민트 주소
 * @returns {[PublicKey, number]} 스테이크 정보 PDA 및 범프 값
 */
function findStakeInfoPDA(nftMint) {
  const mintKey = typeof nftMint === 'string' ? new PublicKey(nftMint) : nftMint;
  
  return PublicKey.findProgramAddressSync(
    [STAKE_SEED, mintKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 에스크로 권한 PDA 생성
 * 
 * @param {PublicKey|string} nftMint - NFT 민트 주소
 * @returns {[PublicKey, number]} 에스크로 권한 PDA 및 범프 값
 */
function findEscrowAuthorityPDA(nftMint) {
  const mintKey = typeof nftMint === 'string' ? new PublicKey(nftMint) : nftMint;
  
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, mintKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 사용자 스테이킹 정보 PDA 생성
 * 
 * @param {PublicKey|string} userWallet - 사용자 지갑 주소
 * @returns {[PublicKey, number]} 사용자 스테이킹 정보 PDA 및 범프 값
 */
function findUserStakingInfoPDA(userWallet) {
  const walletKey = typeof userWallet === 'string' ? new PublicKey(userWallet) : userWallet;
  
  return PublicKey.findProgramAddressSync(
    [USER_STAKING_SEED, walletKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 보상 볼트 권한 PDA 생성
 * 
 * @returns {[PublicKey, number]} 보상 볼트 권한 PDA 및 범프 값
 */
function findRewardVaultAuthorityPDA() {
  return PublicKey.findProgramAddressSync(
    [REWARD_VAULT_AUTHORITY_SEED],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 소셜 활동 PDA 생성
 * 
 * @param {PublicKey|string} userWallet - 사용자 지갑 주소
 * @returns {[PublicKey, number]} 소셜 활동 PDA 및 범프 값
 */
function findSocialActivityPDA(userWallet) {
  const walletKey = typeof userWallet === 'string' ? new PublicKey(userWallet) : userWallet;
  
  return PublicKey.findProgramAddressSync(
    [SOCIAL_SEED, walletKey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 활동 증명 PDA 생성
 * 
 * @param {PublicKey|string} userWallet - 사용자 지갑 주소
 * @param {string} activityId - 활동 ID
 * @returns {[PublicKey, number]} 활동 증명 PDA 및 범프 값
 */
function findActivityProofPDA(userWallet, activityId) {
  const walletKey = typeof userWallet === 'string' ? new PublicKey(userWallet) : userWallet;
  
  return PublicKey.findProgramAddressSync(
    [PROOF_SEED, walletKey.toBuffer(), Buffer.from(activityId)],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * 투표 PDA 생성
 * 
 * @param {PublicKey|string} userWallet - 사용자 지갑 주소
 * @param {PublicKey|string} proposalKey - 제안 계정 주소
 * @returns {[PublicKey, number]} 투표 PDA 및 범프 값
 */
function findVotePDA(userWallet, proposalKey) {
  const walletKey = typeof userWallet === 'string' ? new PublicKey(userWallet) : userWallet;
  const proposalPubkey = typeof proposalKey === 'string' ? new PublicKey(proposalKey) : proposalKey;
  
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, walletKey.toBuffer(), proposalPubkey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

module.exports = {
  findPoolStatePDA,
  findStakeInfoPDA,
  findEscrowAuthorityPDA,
  findUserStakingInfoPDA,
  findRewardVaultAuthorityPDA,
  findSocialActivityPDA,
  findActivityProofPDA,
  findVotePDA
};