/**
 * NFT 스테이킹 정보 조회 API 엔드포인트 (통합 버전)
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

// 공통 모듈에서 필요한 유틸리티 가져오기
import {
  PROGRAM_ID,
  findStakeInfoPDA,
  findUserStakingInfoPDA,
  createApiResponse
} from '../../../shared';

// 환경 변수 가져오기
const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * 스테이킹 진행도 계산 함수
 * 
 * @param {Object} stakingInfo - 스테이킹 정보 객체
 * @returns {number} 진행 백분율 (0-100)
 */
function calculateStakingProgress(stakingInfo) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = stakingInfo.staked_at;
  const endTime = stakingInfo.release_date;
  
  // 스테이킹 기간이 완료된 경우 100% 반환
  if (now >= endTime) {
    return 100;
  }
  
  // 진행도 계산 (시작 시간부터 종료 시간까지)
  const totalDuration = endTime - startTime;
  const elapsedDuration = now - startTime;
  
  return Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));
}

/**
 * 획득 보상 계산 함수
 * 
 * @param {Object} stakingInfo - 스테이킹 정보 객체
 * @returns {number} 획득한 보상
 */
function calculateEarnedRewards(stakingInfo) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = stakingInfo.staked_at;
  const dailyRate = stakingInfo.daily_reward_rate || 0;
  
  // 최대 현재 시간까지만 계산
  const endTime = Math.min(now, stakingInfo.release_date);
  
  // 경과 일 수 계산
  const daysElapsed = (endTime - startTime) / (24 * 60 * 60);
  
  // 총 보상 계산
  const totalRewards = dailyRate * daysElapsed;
  
  return Math.floor(totalRewards);
}

/**
 * 스테이킹 정보 조회 API 핸들러
 */
export default async function handler(req, res) {
  // 메서드 확인
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json(
      createApiResponse(false, 'Method Not Allowed', null, 'Only GET and POST methods are allowed')
    );
  }

  try {
    // 요청 파라미터 가져오기
    const params = req.method === 'GET' ? req.query : req.body;
    const { wallet, mintAddress } = params;
    
    // 필수 파라미터 검증
    if (!wallet || !mintAddress) {
      return res.status(400).json(
        createApiResponse(false, '지갑 주소와 민트 주소는 필수 항목입니다', null, 'MissingParameters')
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
    
    console.log('스테이킹 정보 조회 요청:', { wallet, mintAddress });
    
    // 온체인 상태 확인 (계정 존재 여부)
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    
    // 스테이크 정보 PDA 생성
    const [stakeInfoPDA] = findStakeInfoPDA(mintPubkey);
    const [userStakingInfoPDA] = findUserStakingInfoPDA(walletPubkey);
    
    console.log('Stake Info PDA:', stakeInfoPDA.toString());
    console.log('User Staking Info PDA:', userStakingInfoPDA.toString());
    
    // 계정 정보 확인
    const stakeInfoAccount = await connection.getAccountInfo(stakeInfoPDA);
    const userStakingInfoAccount = await connection.getAccountInfo(userStakingInfoPDA);
    
    console.log('Stake Info 계정 존재 여부:', !!stakeInfoAccount);
    console.log('User Staking Info 계정 존재 여부:', !!userStakingInfoAccount);
    
    // DB에서 스테이킹 정보 조회
    const { data: stakingInfo, error: stakingError } = await supabase
      .from('nft_staking')
      .select('*')
      .eq('wallet_address', wallet)
      .eq('mint_address', mintAddress)
      .eq('status', 'staked')
      .maybeSingle();
    
    if (stakingError) {
      console.error('스테이킹 정보 조회 중 오류:', stakingError);
      return res.status(500).json(
        createApiResponse(false, '스테이킹 정보 조회 실패', null, stakingError)
      );
    }
    
    // 스테이킹 정보가 있는 경우 추가 정보 계산
    if (stakingInfo) {
      // 스테이킹 진행도 계산
      const progressPercentage = calculateStakingProgress(stakingInfo);
      
      // 획득 보상 계산
      const earnedSoFar = calculateEarnedRewards(stakingInfo);
      
      // 현재 시간
      const now = Math.floor(Date.now() / 1000);
      
      // 응답 객체 구성
      const response = {
        isStaked: true,
        stakingInfo: {
          ...stakingInfo,
          progress_percentage: progressPercentage,
          earned_so_far: earnedSoFar,
          is_unlocked: now >= stakingInfo.release_date,
          // 계정 정보
          stake_info_account_exists: !!stakeInfoAccount,
          user_staking_info_account_exists: !!userStakingInfoAccount,
          stake_info_pda: stakeInfoPDA.toString(),
          user_staking_info_pda: userStakingInfoPDA.toString()
        }
      };
      
      return res.status(200).json(
        createApiResponse(true, '스테이킹 정보를 찾았습니다', response)
      );
    } else {
      // 스테이킹 정보가 없는 경우
      return res.status(200).json(
        createApiResponse(true, '스테이킹 정보가 없습니다', {
          isStaked: false,
          stake_info_account_exists: !!stakeInfoAccount,
          user_staking_info_account_exists: !!userStakingInfoAccount
        })
      );
    }
  } catch (error) {
    console.error('스테이킹 정보 조회 중 오류:', error);
    return res.status(500).json(
      createApiResponse(false, '스테이킹 정보 조회 실패', null, error)
    );
  }
}