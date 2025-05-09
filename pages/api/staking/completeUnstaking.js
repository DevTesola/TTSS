/**
 * completeUnstaking.js - NFT 언스테이킹 완료 처리 API
 * 
 * 트랜잭션 확인 후 언스테이킹 과정을 완료하고 데이터베이스 업데이트
 * - 트랜잭션 서명 유효성 검사
 * - 스테이킹 데이터 검증
 * - 보상 및 페널티 계산
 * - 데이터베이스에 언스테이킹 상태 업데이트
 * - 리워드 데이터베이스에 보상 추가
 */

import { Connection } from '@solana/web3.js';
import { getSupabase } from '../../../shared/utils/supabase';
import { calculateUnstakingPenalty } from '../../../utils/staking';
import { createApiResponse, getErrorMessage } from '../../../shared/utils/error-handler';
import { SOLANA_RPC_ENDPOINT } from '../../../shared/constants/network';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      createApiResponse(false, 'Method Not Allowed', null, 'Only POST requests are allowed')
    );
  }

  try {
    const { wallet, mintAddress, txSignature, stakingId } = req.body;
    
    // 필수 입력값 검증
    if (!wallet || !mintAddress || !txSignature || !stakingId) {
      return res.status(400).json(
        createApiResponse(false, '필수 입력 정보가 누락되었습니다', null, 
          'Wallet address, mint address, transaction signature, and staking ID are required')
      );
    }
    
    // Supabase 클라이언트 초기화
    const supabase = getSupabase();
    
    // 트랜잭션 확인
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    try {
      const txInfo = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (!txInfo || txInfo.meta.err) {
        return res.status(400).json(
          createApiResponse(false, '트랜잭션이 확인되지 않았거나 실패했습니다', null, 
            'Transaction was not confirmed or failed')
        );
      }
    } catch (txError) {
      console.error('트랜잭션 검증 오류:', txError);
      return res.status(400).json(
        createApiResponse(false, '트랜잭션 검증 중 오류가 발생했습니다', null, getErrorMessage(txError))
      );
    }
    
    // 스테이킹 레코드 조회
    const { data: stakingData, error: fetchError } = await supabase
      .from('nft_staking')
      .select('*')
      .eq('id', stakingId)
      .eq('wallet_address', wallet)
      .eq('mint_address', mintAddress)
      .eq('status', 'staked')
      .single();
    
    if (fetchError) {
      console.error('스테이킹 레코드 조회 오류:', fetchError);
      return res.status(500).json(
        createApiResponse(false, '스테이킹 레코드 조회에 실패했습니다', null, getErrorMessage(fetchError))
      );
    }
    
    if (!stakingData) {
      return res.status(404).json(
        createApiResponse(false, '스테이킹 레코드를 찾을 수 없습니다', null, 'Staking record not found')
      );
    }
    
    // 언스테이킹 계산에 필요한 데이터 준비
    const currentDate = new Date();
    const stakingStartDate = new Date(stakingData.staked_at);
    const releaseDate = new Date(stakingData.release_date);
    const nftTier = stakingData.nft_tier || 'COMMON';
    const stakingPeriod = stakingData.staking_period;
    
    // 조기 언스테이킹 여부 확인
    const isPremature = currentDate < releaseDate;
    const stakingDays = Math.ceil((currentDate - stakingStartDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = isPremature ? 
      Math.ceil((releaseDate - currentDate) / (1000 * 60 * 60 * 24)) : 0;
    
    console.log('언스테이킹 분석:', {
      isPremature,
      stakingDays,
      daysRemaining,
      nftTier,
      stakingPeriod
    });
    
    // 페널티 및 보상 계산
    let penaltyInfo;
    
    try {
      // 공유 모듈의 계산기 사용
      penaltyInfo = calculateUnstakingPenalty(
        nftTier,
        stakingStartDate,
        currentDate,
        stakingPeriod
      );
    } catch (calcError) {
      console.error('보상 계산 오류, 백업 로직 사용:', calcError);
      
      // 수동 계산 (기존 계산기 오류 시 예비 로직)
      const baseRatePerDay = {
        'COMMON': 10,
        'RARE': 20,
        'EPIC': 35,
        'LEGENDARY': 50
      }[nftTier.toUpperCase()] || 10;
      
      // 장기 스테이킹 보너스
      const longTermBonus = stakingPeriod >= 30 ? 1.1 : 1.0;
      
      // 획득한 보상
      const earnedRewards = Math.round(baseRatePerDay * stakingDays * longTermBonus);
      
      // 페널티 계산 (조기 언스테이킹)
      let penaltyPercentage = 0;
      let penaltyAmount = 0;
      
      if (isPremature) {
        // 남은 기간에 비례한 페널티 (최대 50%)
        const remainingPercent = daysRemaining / stakingPeriod;
        penaltyPercentage = Math.min(Math.round(remainingPercent * 50), 50);
        penaltyAmount = Math.round(earnedRewards * (penaltyPercentage / 100));
      }
      
      // 최종 보상
      const finalReward = earnedRewards - penaltyAmount;
      
      penaltyInfo = {
        isPremature,
        earnedRewards,
        penaltyAmount,
        penaltyPercentage,
        finalReward
      };
    }
    
    console.log('최종 계산된 보상 정보:', penaltyInfo);
    
    // 스테이킹 레코드 업데이트
    const { data: updatedStaking, error: updateError } = await supabase
      .from('nft_staking')
      .update({
        status: 'unstaked',
        unstaked_at: currentDate.toISOString(),
        unstake_tx_signature: txSignature,
        earned_rewards: penaltyInfo.earnedRewards,
        early_unstake_penalty: penaltyInfo.penaltyAmount,
        unstake_penalty_percentage: penaltyInfo.penaltyPercentage,
        final_reward: penaltyInfo.finalReward,
        updated_at: currentDate.toISOString()
      })
      .eq('id', stakingId)
      .select()
      .single();
    
    if (updateError) {
      console.error('스테이킹 레코드 업데이트 오류:', updateError);
      return res.status(500).json(
        createApiResponse(false, '스테이킹 레코드 업데이트에 실패했습니다', null, getErrorMessage(updateError))
      );
    }
    
    // 보상이 있는 경우 리워드 레코드 추가
    if (penaltyInfo.finalReward > 0) {
      const { error: rewardError } = await supabase
        .from('rewards')
        .insert([
          {
            wallet_address: wallet,
            amount: penaltyInfo.finalReward,
            reward_type: 'staking_reward',
            reference_id: `staking_${stakingId}`,
            description: penaltyInfo.isPremature 
              ? `Staking rewards for NFT ${mintAddress.slice(0, 8)}... (Early unstake with ${penaltyInfo.penaltyPercentage}% penalty)`
              : `Staking rewards for NFT ${mintAddress.slice(0, 8)}... (Complete staking period)`,
            claimed: false
          }
        ]);
      
      if (rewardError) {
        console.error('리워드 레코드 생성 오류:', rewardError);
        // 이 오류는 로깅만 하고 진행
      }
    }
    
    // 성공 응답
    return res.status(200).json(
      createApiResponse(true, 
        penaltyInfo.isPremature
          ? `NFT를 조기 언스테이킹했습니다. ${penaltyInfo.penaltyPercentage}% 페널티가 적용되었습니다.`
          : 'NFT 스테이킹 기간을 성공적으로 완료했습니다.',
        {
          stakingId,
          mintAddress,
          earnedRewards: penaltyInfo.earnedRewards,
          penalty: penaltyInfo.penaltyAmount,
          finalReward: penaltyInfo.finalReward,
          isPremature: penaltyInfo.isPremature
        }
      )
    );
    
  } catch (error) {
    console.error('completeUnstaking API 오류:', error);
    return res.status(500).json(
      createApiResponse(false, '언스테이킹 완료 과정에서 오류가 발생했습니다', null, getErrorMessage(error))
    );
  }
}