/**
 * NFT 스테이킹 준비 API 엔드포인트 (통합 버전)
 * 기존 v1, v2, v3 버전을 통합한 새 구현
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// 공통 모듈에서 필요한 유틸리티 가져오기
import {
  PROGRAM_ID,
  NFT_TIERS,
  createSerializedTransaction,
  createTokenAccountInstruction,
  createInitUserStakingInfoInstruction,
  createStakeNftInstruction,
  findPoolStatePDA,
  findStakeInfoPDA,
  findEscrowAuthorityPDA,
  findUserStakingInfoPDA,
  getErrorMessage,
  createApiResponse
} from '../../../shared';

// 환경 변수 가져오기
const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * NFT 티어 값을 표준화하는 헬퍼 함수
 * 
 * @param {string} tierValue - 원시 티어 값
 * @returns {string} 표준화된 티어 값
 */
function standardizeTier(tierValue) {
  if (!tierValue) return 'COMMON';
  
  const tier = tierValue.trim().toUpperCase();
  if (tier.includes('LEGEND')) return 'LEGENDARY';
  if (tier.includes('EPIC')) return 'EPIC';
  if (tier.includes('RARE')) return 'RARE';
  return 'COMMON';
}

/**
 * 예상 보상 계산 함수
 * 
 * @param {string} nftTier - NFT 등급
 * @param {number} stakingPeriod - 스테이킹 기간(일)
 * @returns {Object} 보상 관련 정보
 */
function calculateEstimatedRewards(nftTier, stakingPeriod) {
  // 티어별 일일 기본 보상률
  const dailyRewardsByTier = {
    'LEGENDARY': 200,  // 200 TESOLA per day
    'EPIC': 100,       // 100 TESOLA per day
    'RARE': 50,        // 50 TESOLA per day
    'COMMON': 25       // 25 TESOLA per day
  };
  
  // 일일 기본 보상률 계산
  const baseRate = dailyRewardsByTier[nftTier] || dailyRewardsByTier.COMMON;
  
  // 장기 스테이킹 승수 계산
  let multiplier = 1.0;
  
  // 장기 스테이킹 보너스
  if (stakingPeriod >= 365) multiplier = 2.0;      // 365+ days: 2x
  else if (stakingPeriod >= 180) multiplier = 1.7; // 180+ days: 1.7x
  else if (stakingPeriod >= 90) multiplier = 1.4;  // 90+ days: 1.4x
  else if (stakingPeriod >= 30) multiplier = 1.2;  // 30+ days: 1.2x
  
  // 총 예상 보상 계산
  const totalRewards = Math.floor(baseRate * stakingPeriod * multiplier);
  
  // 일별 보상 배열 생성 (최대 7일까지만)
  const dailyRewards = [];
  for (let day = 0; day < Math.min(stakingPeriod, 7); day++) {
    dailyRewards.push(Math.floor(baseRate * multiplier));
  }
  
  // 평균 일일 보상 계산
  const averageDailyReward = totalRewards / stakingPeriod;
  
  // 장기 보너스 백분율
  const longTermBonus = Math.floor((multiplier - 1.0) * 100);
  
  return {
    baseRate,
    totalRewards,
    dailyRewards,
    averageDailyReward,
    longTermBonus
  };
}

/**
 * 스테이킹 준비 API 핸들러
 */
export default async function handler(req, res) {
  // POST 메서드 확인
  if (req.method !== 'POST') {
    return res.status(405).json(
      createApiResponse(false, 'Method Not Allowed', null, 'Only POST method is allowed')
    );
  }

  // API 버전 파라미터 확인 (v1, v2, v3 또는 기본값)
  const apiVersion = req.query.version || 'v3';
  console.log(`스테이킹 준비 API 버전: ${apiVersion}`);

  try {
    // 요청 파라미터 가져오기
    const { wallet, mintAddress, stakingPeriod, nftTier: requestedTier, rawTierValue, nftName } = req.body;
    
    // 필수 파라미터 검증
    if (!wallet || !mintAddress || !stakingPeriod) {
      return res.status(400).json(
        createApiResponse(false, '지갑 주소, 민트 주소, 스테이킹 기간은 필수 항목입니다', null, 'MissingParameters')
      );
    }
    
    // PublicKey 변환 및 검증
    let walletPubkey, mintPubkey;
    try {
      walletPubkey = new PublicKey(wallet);
      mintPubkey = new PublicKey(mintAddress);
    } catch (err) {
      return res.status(400).json(
        createApiResponse(false, '유효하지 않은 주소 형식', null, err)
      );
    }
    
    // 스테이킹 기간 검증
    const stakingPeriodNum = parseInt(stakingPeriod, 10);
    if (isNaN(stakingPeriodNum) || stakingPeriodNum < 7 || stakingPeriodNum > 365) {
      return res.status(400).json(
        createApiResponse(false, '스테이킹 기간은 7일에서 365일 사이여야 합니다', null, 'InvalidStakingPeriod')
      );
    }
    
    console.log('스테이킹 요청 받음:', { wallet, mintAddress, stakingPeriod: stakingPeriodNum });
    
    // 이미 스테이킹되었는지 확인
    const { data: existingStake, error: existingError } = await supabase
      .from('nft_staking')
      .select('*')
      .eq('wallet_address', wallet)
      .eq('mint_address', mintAddress)
      .eq('status', 'staked')
      .maybeSingle();
    
    if (existingError && existingError.code !== 'PGRST116') {
      console.error('기존 스테이킹 확인 중 오류:', existingError);
      return res.status(500).json(
        createApiResponse(false, '스테이킹 상태 확인 실패', null, existingError)
      );
    }
    
    if (existingStake) {
      console.log('NFT 이미 스테이킹됨:', existingStake);
      return res.status(400).json(
        createApiResponse(
          false, 
          `이 NFT는 이미 ${new Date(existingStake.release_date).toLocaleDateString()}까지 스테이킹되어 있습니다`, 
          null, 
          { errorCode: 'AlreadyStaked', existingStake }
        )
      );
    }
    
    // Solana 연결 설정
    console.log('Solana RPC에 연결 중:', SOLANA_RPC_ENDPOINT);
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    
    // NFT 소유권 확인
    console.log('NFT 소유권 확인 중...');
    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
        mint: mintPubkey
      });
      
      if (tokenAccounts.value.length === 0) {
        console.log('NFT 소유권 확인 실패: 토큰 계정 없음');
        return res.status(403).json(
          createApiResponse(false, '이 NFT의 소유자가 아닙니다', null, 'NotOwner')
        );
      }
      
      // 사용자 토큰 계정에 1개의 토큰이 있는지 확인
      const hasToken = tokenAccounts.value.some(account => {
        const accountInfo = account.account.data;
        // Solana 토큰 계정 데이터 파싱
        const amount = accountInfo.readBigUInt64LE(64);
        return amount === 1n; // 1 NFT
      });
      
      if (!hasToken) {
        console.log('NFT 소유권 확인 실패: 토큰 없음');
        return res.status(403).json(
          createApiResponse(false, '이 NFT의 소유자가 아닙니다', null, 'NotOwner')
        );
      }
      
      console.log('NFT 소유권 확인됨');
    } catch (tokenCheckError) {
      console.error('토큰 계정 확인 중 오류:', tokenCheckError);
      return res.status(500).json(
        createApiResponse(false, 'NFT 소유권 확인 실패', null, tokenCheckError)
      );
    }
    
    // NFT 등급 결정 (요청에서 제공된 등급 또는 DB에서 조회)
    let nftTier = requestedTier || "COMMON";
    
    // 등급 정보가 없으면 데이터베이스에서 조회
    if (!nftTier || nftTier === "COMMON") {
      try {
        console.log('NFT 메타데이터 가져오는 중:', mintAddress);
        const { data: nftData } = await supabase
          .from('minted_nfts')
          .select('metadata, name')
          .eq('mint_address', mintAddress)
          .maybeSingle();
        
        if (nftData && nftData.metadata) {
          let metadata;
          
          try {
            metadata = typeof nftData.metadata === 'string' 
              ? JSON.parse(nftData.metadata) 
              : nftData.metadata;
              
            const tierAttr = metadata.attributes?.find(attr => 
              attr.trait_type?.toLowerCase() === "tier"
            );
            
            if (tierAttr && tierAttr.value) {
              const rawValue = tierAttr.value;
              nftTier = standardizeTier(rawValue);
              console.log('NFT 등급 찾음:', nftTier, '원본 값:', rawValue);
            }
          } catch (parseError) {
            console.error('메타데이터 파싱 오류:', parseError);
          }
        }
      } catch (tierError) {
        console.error('NFT 등급 조회 오류:', tierError);
      }
    }
    
    // NFT 등급 -> 인덱스 변환
    const nftTierIndex = NFT_TIERS[nftTier] || NFT_TIERS.COMMON;
    
    // PDA 주소 생성
    const [poolStatePDA] = findPoolStatePDA();
    const [stakeInfoPDA] = findStakeInfoPDA(mintPubkey);
    const [escrowAuthorityPDA] = findEscrowAuthorityPDA(mintPubkey);
    const [userStakingInfoPDA] = findUserStakingInfoPDA(walletPubkey);
    
    console.log('Pool State PDA:', poolStatePDA.toString());
    console.log('Stake Info PDA:', stakeInfoPDA.toString());
    console.log('Escrow Authority PDA:', escrowAuthorityPDA.toString());
    console.log('User Staking Info PDA:', userStakingInfoPDA.toString());
    
    // 사용자 토큰 계정 주소 가져오기
    const userTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      walletPubkey
    );
    
    // Escrow 토큰 계정 주소 가져오기
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      escrowAuthorityPDA,
      true  // allow owner off curve
    );
    
    // 최근 블록해시 가져오기
    console.log('최근 블록해시 가져오는 중...');
    const blockHashData = await connection.getLatestBlockhash('confirmed');
    const blockhash = blockHashData.blockhash;
    const lastValidBlockHeight = blockHashData.lastValidBlockHeight;
    
    // 명령어 배열 생성
    const instructions = [];
    
    // 1. User Staking Info 계정이 존재하는지 확인
    const userStakingInfoExists = !!(await connection.getAccountInfo(userStakingInfoPDA));
    if (!userStakingInfoExists) {
      // User Staking Info 초기화 명령어 추가
      console.log('User Staking Info 초기화 명령어 추가...');
      instructions.push(
        createInitUserStakingInfoInstruction(walletPubkey, userStakingInfoPDA)
      );
    }
    
    // 2. Escrow 토큰 계정 존재 확인 및 필요시 생성 명령 추가
    const escrowTokenAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
    if (!escrowTokenAccountInfo) {
      console.log('Escrow 토큰 계정 생성 명령어 추가...');
      const createEscrowATAIx = await createTokenAccountInstruction(
        walletPubkey,
        mintPubkey,
        escrowAuthorityPDA
      );
      instructions.push(createEscrowATAIx);
    }
    
    // 3. 스테이킹 명령어 추가
    console.log('스테이킹 명령어 추가...');
    const stakeNftIx = createStakeNftInstruction(
      walletPubkey,
      mintPubkey,
      poolStatePDA,
      stakingPeriodNum,
      nftTierIndex,
      false, // autoCompound (기본값 false)
      {
        stakeInfo: stakeInfoPDA,
        escrowTokenAccount,
        escrowAuthority: escrowAuthorityPDA,
        userTokenAccount,
        userStakingInfo: userStakingInfoPDA
      }
    );
    instructions.push(stakeNftIx);
    
    // 최종 트랜잭션 생성 및 직렬화
    const serializedTx = createSerializedTransaction(
      instructions,
      walletPubkey,
      blockhash,
      lastValidBlockHeight
    );
    
    // v2/v3 호환성을 위한 두 단계 트랜잭션 버전도 준비
    // 1단계: 계정 초기화 명령어
    const initInstructions = [];
    if (!userStakingInfoExists) {
      initInstructions.push(
        createInitUserStakingInfoInstruction(walletPubkey, userStakingInfoPDA)
      );
    }
    if (!escrowTokenAccountInfo) {
      const createEscrowATAIx = await createTokenAccountInstruction(
        walletPubkey,
        mintPubkey,
        escrowAuthorityPDA
      );
      initInstructions.push(createEscrowATAIx);
    }
    
    // 2단계: 스테이킹 명령어
    const stakeInstructions = [stakeNftIx];
    
    // 각 단계별 직렬화된 트랜잭션
    let phase1Tx = null;
    if (initInstructions.length > 0) {
      phase1Tx = createSerializedTransaction(
        initInstructions,
        walletPubkey,
        blockhash,
        lastValidBlockHeight
      );
    }
    
    const phase2Tx = createSerializedTransaction(
      stakeInstructions,
      walletPubkey,
      blockhash,
      lastValidBlockHeight
    );
    
    // 보상 계산
    const rewardCalculation = calculateEstimatedRewards(nftTier, stakingPeriodNum);
    
    // 응답 객체 구성
    const response = {
      // 지갑 및 NFT 정보
      wallet,
      mintAddress,
      nftName: nftName || `NFT #${mintAddress.slice(0, 6)}`,
      
      // 스테이킹 정보
      stakingPeriod: stakingPeriodNum,
      nftTier,
      nftTierIndex,
      
      // 트랜잭션 데이터
      transactionBase64: serializedTx,
      
      // 두 단계 트랜잭션 데이터 (v2/v3 호환)
      twoPhaseExecution: true,
      transactions: {
        phase1: phase1Tx,
        phase2: phase2Tx
      },
      
      // 계정 주소
      accounts: {
        poolState: poolStatePDA.toString(),
        stakeInfo: stakeInfoPDA.toString(),
        escrowAuthority: escrowAuthorityPDA.toString(),
        userStakingInfo: userStakingInfoPDA.toString(),
        escrowTokenAccount: escrowTokenAccount.toString(),
        userTokenAccount: userTokenAccount.toString()
      },
      
      // 보상 정보
      rewardDetails: {
        ...rewardCalculation,
        nftTier,
        rawTierValue
      },
      
      // 트랜잭션 만료 정보
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      expiryHeight: lastValidBlockHeight
    };
    
    // 응답 반환
    return res.status(200).json(
      createApiResponse(true, '스테이킹 트랜잭션이 준비되었습니다', response)
    );
  } catch (error) {
    console.error('스테이킹 트랜잭션 준비 중 오류:', error);
    return res.status(500).json(
      createApiResponse(false, '스테이킹 트랜잭션 준비 실패', null, error)
    );
  }
}