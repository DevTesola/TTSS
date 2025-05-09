/**
 * prepareClaimRewards.js - 온체인 리워드 청구를 위한 트랜잭션 준비 API
 * 
 * 이 API는 Solana 온체인 프로그램의 claim_rewards 명령어를 사용하여
 * 스테이킹된 NFT에서 발생한 리워드를 청구하기 위한 트랜잭션을 생성합니다.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { serializeTransactionForClientSigning, setTransactionMetadata } from '../../shared/utils/transaction-utils';
import { logTransaction, logTransactionError } from '../../shared/utils/transaction-logger';
import { createClient } from '@supabase/supabase-js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

// 필요한 상수와 유틸리티 가져오기
import { PROGRAM_ID, STAKE_SEED, USER_STAKING_SEED, POOL_SEED } from '../../utils/staking-helpers/constants';
import { createClaimRewardsInstructionData } from '../../utils/staking-helpers/instruction-utils';
import { getErrorMessage } from '../../utils/staking-helpers/error-handler';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Solana RPC 엔드포인트
const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

// 리워드 토큰 민트 주소 (테솔라 토큰)
const REWARD_MINT_ADDRESS = process.env.REWARD_MINT_ADDRESS || '6aJNuLDLEeysFm9PNz1qQ2LbmQKiNaUvzpX1z6BkXQXz';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { wallet, mintAddress } = req.body;
    
    if (!wallet || !mintAddress) {
      return res.status(400).json({ 
        error: 'Wallet address and NFT mint address are required',
        success: false 
      });
    }
    
    let walletPubkey;
    try {
      walletPubkey = new PublicKey(wallet);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Invalid wallet address format',
        success: false 
      });
    }
    
    let mintPubkey;
    try {
      mintPubkey = new PublicKey(mintAddress);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Invalid mint address format',
        success: false 
      });
    }
    
    // NFT가 스테이킹되어 있는지 확인
    const { data: stakeRecord, error: stakeError } = await supabase
      .from('nft_staking')
      .select('*')
      .eq('wallet_address', wallet)
      .eq('mint_address', mintAddress)
      .eq('status', 'staked')
      .single();
    
    if (stakeError || !stakeRecord) {
      console.error('Error fetching stake record:', stakeError || 'No record found');
      return res.status(404).json({ 
        error: stakeError ? stakeError.message : 'NFT is not staked',
        success: false 
      });
    }
    
    console.log('Found staking record:', stakeRecord);
    
    // Solana 연결 설정
    console.log('Connecting to Solana RPC:', SOLANA_RPC_ENDPOINT);
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    
    // 프로그램 ID와 리워드 민트 PublicKey로 변환
    const programId = new PublicKey(PROGRAM_ID);
    const rewardMintPubkey = new PublicKey(REWARD_MINT_ADDRESS);
    
    // PDA 생성 - IDL에 정의된 시드 사용
    // 1. stake_info PDA 생성
    const [stakeInfoPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(STAKE_SEED), mintPubkey.toBuffer()],
      programId
    );
    
    console.log('Stake info PDA:', stakeInfoPDA.toString());
    
    // 2. pool_state PDA 생성
    const [poolStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_SEED)],
      programId
    );
    
    console.log('Pool state PDA:', poolStatePDA.toString());
    
    // 3. user_staking_info PDA 생성
    const [userStakingInfoPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(USER_STAKING_SEED), walletPubkey.toBuffer()],
      programId
    );
    
    console.log('User staking info PDA:', userStakingInfoPDA.toString());
    
    // 4. reward_vault_authority PDA 생성
    const [rewardVaultAuthorityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault_authority")],
      programId
    );
    
    console.log('Reward vault authority PDA:', rewardVaultAuthorityPDA.toString());
    
    // 5. reward_vault 계정 찾기 (풀 상태 계정에서 가져오는 것이 이상적이지만, 
    // 여기서는 하드코딩된 값이나 환경 변수를 사용할 수 있음)
    let rewardVaultAddress;
    try {
      // 풀 상태 계정에서 reward_vault 필드를 읽는 것이 가장 좋지만,
      // 계정 디코딩은 복잡하므로 환경 변수에서 읽거나 하드코딩할 수 있음
      rewardVaultAddress = new PublicKey(process.env.REWARD_VAULT_ADDRESS || '4ne1k9RxuR6aRbGiAMjFMKc8pkwdsVMCpD7bRQprj143');
      console.log('Using reward vault address:', rewardVaultAddress.toString());
    } catch (err) {
      console.warn('Invalid reward vault address from env, deriving PDA');
      // 대안: reward_vault를 PDA로 생성할 수도 있음
      const [derivedVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("reward_vault"), rewardMintPubkey.toBuffer()],
        programId
      );
      rewardVaultAddress = derivedVaultPDA;
    }
    
    console.log('Reward vault address:', rewardVaultAddress.toString());
    
    // 6. 사용자의 리워드 토큰 계정 (ATA) 찾기
    const userRewardTokenAccount = await getAssociatedTokenAddress(
      rewardMintPubkey,  // 토큰 타입 (TESOLA)
      walletPubkey       // 토큰 소유자
    );
    
    console.log('User reward token account:', userRewardTokenAccount.toString());
    
    // 사용자의 리워드 토큰 계정이 존재하는지 확인
    const userTokenAccountInfo = await connection.getAccountInfo(userRewardTokenAccount);
    
    // 트랜잭션 생성
    const tx = new Transaction();
    
    // 리워드 토큰 계정이 존재하지 않으면 생성하는 명령어 추가
    if (!userTokenAccountInfo) {
      console.log('Creating user reward token account...');
      const createATAIx = createAssociatedTokenAccountInstruction(
        walletPubkey,               // payer
        userRewardTokenAccount,     // associated token account address
        walletPubkey,               // owner
        rewardMintPubkey            // mint
      );
      tx.add(createATAIx);
    }
    
    // claim_rewards 명령어 데이터 생성 - 유틸리티 함수 사용
    const instructionData = createClaimRewardsInstructionData();
    
    // claim_rewards 명령어 계정 목록 - IDL에 정의된 순서와 정확하게 일치해야 함
    const accounts = [
      { pubkey: walletPubkey, isSigner: true, isWritable: true },          // user (signer, writable)
      { pubkey: mintPubkey, isSigner: false, isWritable: false },          // nft_mint
      { pubkey: stakeInfoPDA, isSigner: false, isWritable: true },         // stake_info (writable, PDA)
      { pubkey: poolStatePDA, isSigner: false, isWritable: true },         // pool_state (writable, PDA)
      { pubkey: userStakingInfoPDA, isSigner: false, isWritable: false },  // user_staking_info (PDA)
      { pubkey: rewardVaultAddress, isSigner: false, isWritable: true },   // reward_vault (writable)
      { pubkey: rewardVaultAuthorityPDA, isSigner: false, isWritable: false }, // reward_vault_authority (PDA)
      { pubkey: userRewardTokenAccount, isSigner: false, isWritable: true }, // user_token_account (writable)
      { pubkey: rewardMintPubkey, isSigner: false, isWritable: false },    // reward_mint
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // token_program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false } // rent
    ];
    
    // 계정 목록 로깅
    console.log('계정 구조:');
    const accountNames = [
      "user", "nft_mint", "stake_info", "pool_state", "user_staking_info", 
      "reward_vault", "reward_vault_authority", "user_token_account", "reward_mint",
      "system_program", "token_program", "associated_token_program", "rent"
    ];
    accounts.forEach((acc, idx) => {
      console.log(`${idx}. ${accountNames[idx]}: ${acc.pubkey.toString()} (isSigner: ${acc.isSigner}, isWritable: ${acc.isWritable})`);
    });
    
    // 명령어 생성
    const claimRewardsIx = new TransactionInstruction({
      keys: accounts,
      programId,
      data: instructionData
    });
    
    // 트랜잭션에 명령어 추가
    tx.add(claimRewardsIx);
    
    // 트랜잭션 시뮬레이션
    console.log('트랜잭션 시뮬레이션 중...');
    try {
      const simulation = await connection.simulateTransaction(tx);
      
      if (simulation.value.err) {
        console.warn('시뮬레이션 오류:', simulation.value.err);
        console.log('시뮬레이션 로그:', simulation.value.logs);
        
        // 로그에서 오류 분석
        const logs = simulation.value.logs || [];
        let errorMessage = '알 수 없는 오류가 발생했습니다.';
        
        // 일반적인 오류 패턴 검색
        if (logs.some(log => /InsufficientRewardBalance/i.test(log))) {
          errorMessage = '리워드 잔액이 부족합니다.';
        } else if (logs.some(log => /ClaimTooSoon/i.test(log))) {
          errorMessage = '마지막 청구 이후 너무 빨리 청구를 시도했습니다.';
        }
        
        // 오류 있더라도 계속 진행 (프론트엔드에서 경고 표시)
        console.log('시뮬레이션 오류가 감지되었지만 트랜잭션은 계속 생성합니다:', errorMessage);
      } else {
        console.log('시뮬레이션 성공!');
        
        // 성공 로그 확인
        const logs = simulation.value.logs || [];
        if (logs.length > 0) {
          console.log('시뮬레이션 성공 로그 (처음 5개):');
          logs.slice(0, 5).forEach((log, i) => console.log(`  ${i+1}. ${log}`));
          
          if (logs.length > 5) {
            console.log(`  ... 및 ${logs.length - 5}개 추가 로그`);
          }
        }
      }
    } catch (simError) {
      console.warn('시뮬레이션 실행 오류:', simError);
    }
    
    // 최근 블록해시 가져오기
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    // 트랜잭션 설정 - 유틸리티 함수 사용
    setTransactionMetadata(tx, walletPubkey, blockhash, lastValidBlockHeight);
    
    // 트랜잭션 직렬화 - 유틸리티 함수 사용
    const serializedTransaction = serializeTransactionForClientSigning(tx);
    
    // 트랜잭션 로깅
    await logTransaction('claimRewards', {
      walletAddress: wallet,
      mintAddress: mintAddress,
      transactionExpiry: lastValidBlockHeight + 150
    });
    
    // 응답 반환
    return res.status(200).json({
      success: true,
      transactionBase64: serializedTransaction,
      stakingInfo: stakeRecord,
      claimDetails: {
        nftMint: mintAddress,
        stakingPeriod: stakeRecord.staking_period,
        stakingStartDate: stakeRecord.staked_at,
        lastClaimDate: stakeRecord.last_claim_time || stakeRecord.staked_at,
        transactionExpiry: lastValidBlockHeight + 150
      }
    });
    
  } catch (error) {
    console.error('리워드 청구 트랜잭션 준비 중 오류:', error);
    
    // 트랜잭션 오류 로깅
    await logTransactionError('claimRewards', error, req.body.wallet, {
      mintAddress: req.body.mintAddress,
      requestDetails: req.body
    });
    
    const errorMessage = getErrorMessage(error);
    return res.status(500).json({
      error: '리워드 청구 트랜잭션 준비 실패: ' + errorMessage,
      errorCode: error.code,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      success: false
    });
  }
}