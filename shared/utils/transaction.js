/**
 * Solana 트랜잭션 생성 및 처리를 위한 유틸리티 함수
 */

const {
  Transaction,
  PublicKey,
  SystemProgram,
  TransactionInstruction
} = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');

const { PROGRAM_ID } = require('../constants/program-ids');
const { INSTRUCTION_DISCRIMINATORS } = require('../constants/discriminators');
const {
  serializeTransactionForClientSigning,
  setTransactionMetadata
} = require('./transaction-utils');

/**
 * 클라이언트에서 서명할 수 있는 직렬화된 트랜잭션 생성
 *
 * @param {TransactionInstruction[]} instructions - 트랜잭션에 포함할 명령어 배열
 * @param {PublicKey} feePayer - 트랜잭션 수수료 지불자 (지갑 주소)
 * @param {string} blockhash - 최근 블록해시
 * @param {number} lastValidBlockHeight - 마지막 유효 블록 높이
 * @returns {string} Base64로 인코딩된 직렬화된 트랜잭션
 */
function createSerializedTransaction(instructions, feePayer, blockhash, lastValidBlockHeight) {
  const transaction = new Transaction();

  // 트랜잭션에 명령어 추가
  instructions.forEach(instruction => transaction.add(instruction));

  // 트랜잭션 메타데이터 설정
  setTransactionMetadata(transaction, feePayer, blockhash, lastValidBlockHeight);

  // 서명 없이 직렬화 - 클라이언트에서 서명할 수 있도록
  return serializeTransactionForClientSigning(transaction);
}

/**
 * 토큰 계정(ATA) 생성 명령어 생성
 * 
 * @param {PublicKey} wallet - 소유자 지갑 주소
 * @param {PublicKey} mint - 토큰 민트 주소
 * @returns {TransactionInstruction} 토큰 계정 생성 명령어
 */
async function createTokenAccountInstruction(wallet, mint) {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    wallet,
    false
  );
  
  return createAssociatedTokenAccountInstruction(
    wallet,            // 수수료 지불자
    tokenAccount,      // 생성할 계정
    wallet,            // 계정 소유자
    mint               // 토큰 민트
  );
}

/**
 * NFT 스테이킹 명령어 생성
 * 
 * @param {PublicKey} owner - NFT 소유자 주소
 * @param {PublicKey} nftMint - NFT 민트 주소
 * @param {PublicKey} poolState - 풀 상태 계정 주소
 * @param {number} stakingPeriod - 스테이킹 기간(일)
 * @param {number} nftTier - NFT 등급 (0-3)
 * @param {boolean} autoCompound - 자동 복리 여부
 * @param {Object} accounts - 추가 계정들(PDAs)
 * @returns {TransactionInstruction} 스테이킹 명령어
 */
function createStakeNftInstruction(
  owner, 
  nftMint, 
  poolState, 
  stakingPeriod, 
  nftTier, 
  autoCompound = false,
  accounts
) {
  // 데이터 버퍼 생성
  const stakingPeriodBuf = Buffer.alloc(8);
  stakingPeriodBuf.writeBigUInt64LE(BigInt(stakingPeriod));
  
  const nftTierBuf = Buffer.from([nftTier]);
  const autoCompoundBuf = Buffer.from([autoCompound ? 1 : 0]);
  
  // 명령어 데이터 구성
  const data = Buffer.concat([
    Buffer.from(INSTRUCTION_DISCRIMINATORS.STAKE_NFT),
    stakingPeriodBuf,
    nftTierBuf,
    autoCompoundBuf
  ]);
  
  // 계정 배열 구성
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },      // owner
    { pubkey: nftMint, isSigner: false, isWritable: false },  // nft_mint
    { pubkey: accounts.stakeInfo, isSigner: false, isWritable: true },       // stake_info
    { pubkey: accounts.escrowTokenAccount, isSigner: false, isWritable: true },  // escrow_nft_account
    { pubkey: accounts.escrowAuthority, isSigner: false, isWritable: false },    // escrow_authority
    { pubkey: accounts.userTokenAccount, isSigner: false, isWritable: true },    // user_nft_account
    { pubkey: accounts.userStakingInfo, isSigner: false, isWritable: true },     // user_staking_info
    { pubkey: poolState, isSigner: false, isWritable: true },  // pool_state
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },     // system_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },            // token_program
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false } // rent
  ];
  
  // 명령어 생성
  return new TransactionInstruction({
    keys,
    programId: new PublicKey(PROGRAM_ID),
    data
  });
}

/**
 * NFT 언스테이킹 명령어 생성
 * 
 * @param {PublicKey} owner - NFT 소유자 주소
 * @param {PublicKey} nftMint - NFT 민트 주소
 * @param {PublicKey} poolState - 풀 상태 계정 주소
 * @param {Object} accounts - 추가 계정들(PDAs)
 * @returns {TransactionInstruction} 언스테이킹 명령어
 */
function createUnstakeNftInstruction(
  owner, 
  nftMint, 
  poolState, 
  accounts
) {
  // 명령어 데이터 (식별자만 포함)
  const data = Buffer.from(INSTRUCTION_DISCRIMINATORS.UNSTAKE_NFT);
  
  // 계정 배열 구성
  const keys = [
    { pubkey: owner, isSigner: true, isWritable: true },      // owner
    { pubkey: nftMint, isSigner: false, isWritable: false },  // nft_mint
    { pubkey: accounts.stakeInfo, isSigner: false, isWritable: true },       // stake_info
    { pubkey: accounts.escrowTokenAccount, isSigner: false, isWritable: true },  // escrow_nft_account
    { pubkey: accounts.escrowAuthority, isSigner: false, isWritable: false },    // escrow_authority
    { pubkey: accounts.userTokenAccount, isSigner: true, isWritable: true },     // user_nft_account
    { pubkey: accounts.userStakingInfo, isSigner: false, isWritable: true },     // user_staking_info
    { pubkey: poolState, isSigner: false, isWritable: true },  // pool_state
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },     // system_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },            // token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false } // rent
  ];
  
  // 명령어 생성
  return new TransactionInstruction({
    keys,
    programId: new PublicKey(PROGRAM_ID),
    data
  });
}

/**
 * 보상 청구 명령어 생성
 * 
 * @param {PublicKey} user - 사용자 지갑 주소
 * @param {PublicKey} nftMint - NFT 민트 주소
 * @param {PublicKey} rewardMint - 보상 토큰 민트 주소
 * @param {Object} accounts - 추가 계정들(PDAs)
 * @returns {TransactionInstruction} 보상 청구 명령어
 */
function createClaimRewardsInstruction(
  user,
  nftMint,
  rewardMint,
  accounts
) {
  // 명령어 데이터 (식별자만 포함)
  const data = Buffer.from(INSTRUCTION_DISCRIMINATORS.CLAIM_REWARDS);
  
  // 계정 배열 구성
  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },           // user
    { pubkey: nftMint, isSigner: false, isWritable: false },      // nft_mint
    { pubkey: accounts.stakeInfo, isSigner: false, isWritable: true },         // stake_info
    { pubkey: accounts.poolState, isSigner: false, isWritable: true },         // pool_state
    { pubkey: accounts.userStakingInfo, isSigner: false, isWritable: false },  // user_staking_info
    { pubkey: accounts.rewardVault, isSigner: false, isWritable: true },       // reward_vault
    { pubkey: accounts.rewardVaultAuthority, isSigner: false, isWritable: false }, // reward_vault_authority
    { pubkey: accounts.userTokenAccount, isSigner: false, isWritable: true },  // user_token_account
    { pubkey: rewardMint, isSigner: false, isWritable: false },    // reward_mint
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },   // system_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },          // token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false } // rent
  ];
  
  // 명령어 생성
  return new TransactionInstruction({
    keys,
    programId: new PublicKey(PROGRAM_ID),
    data
  });
}

/**
 * 사용자 스테이킹 정보 초기화 명령어 생성
 * 
 * @param {PublicKey} user - 사용자 지갑 주소
 * @param {PublicKey} userStakingInfo - 사용자 스테이킹 정보 PDA
 * @returns {TransactionInstruction} 초기화 명령어
 */
function createInitUserStakingInfoInstruction(user, userStakingInfo) {
  // 명령어 데이터 (식별자만 포함)
  const data = Buffer.from(INSTRUCTION_DISCRIMINATORS.INIT_USER_STAKING_INFO);
  
  // 계정 배열 구성
  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },                    // user
    { pubkey: userStakingInfo, isSigner: false, isWritable: true },        // user_staking_info
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // system_program
  ];
  
  // 명령어 생성
  return new TransactionInstruction({
    keys,
    programId: new PublicKey(PROGRAM_ID),
    data
  });
}

module.exports = {
  createSerializedTransaction,
  createTokenAccountInstruction,
  createStakeNftInstruction,
  createUnstakeNftInstruction,
  createClaimRewardsInstruction,
  createInitUserStakingInfoInstruction
};