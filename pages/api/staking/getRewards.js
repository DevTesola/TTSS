/**
 * getRewards.js - 유저 보상 조회 API
 * 
 * 사용자의 보상 내역, 청구 가능한 보상, 총 보상 금액 등을 조회
 * - 보상 내역 조회
 * - 청구 가능한 보상 필터링
 * - 총 보상 금액 계산
 */

import { getSupabase, getSupabaseAdmin } from '../../../shared/utils/supabase';
import { createApiResponse, getErrorMessage } from '../../../shared/utils/error-handler';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(
      createApiResponse(false, 'Method Not Allowed', null, 'Only GET requests are allowed')
    );
  }

  try {
    const { wallet } = req.query;
    
    // 필수 입력값 검증
    if (!wallet) {
      return res.status(400).json(
        createApiResponse(false, '지갑 주소가 필요합니다', null, 'Wallet address is required')
      );
    }
    
    console.log('지갑에 대한 보상 조회:', wallet);
    
    // 관리자 권한으로 Supabase 클라이언트 초기화 (RLS 우회)
    const supabase = getSupabaseAdmin();
    
    // 사용자의 보상 내역 조회
    const { data: rewards, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('보상 조회 오류:', error);
      return res.status(500).json(
        createApiResponse(false, '보상 조회에 실패했습니다', null, getErrorMessage(error))
      );
    }
    
    console.log(`지갑 ${wallet}에 대해 ${rewards?.length || 0}개의 보상을 찾았습니다`);
    
    // 보상 유형별 그룹화
    const rewardsByType = rewards.reduce((acc, reward) => {
      const type = reward.reward_type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(reward);
      return acc;
    }, {});
    
    // 청구 가능한 보상 필터링
    const claimableRewards = rewards.filter(reward => !reward.claimed);
    
    // 총 청구 가능한 보상 금액 계산
    const totalRewards = claimableRewards.reduce((sum, reward) => sum + reward.amount, 0);
    
    // 청구 가능한 보상의 유형별 합계 계산
    const rewardSummaryByType = Object.entries(rewardsByType).reduce((acc, [type, typeRewards]) => {
      const claimable = typeRewards.filter(r => !r.claimed);
      const claimed = typeRewards.filter(r => r.claimed);
      
      acc[type] = {
        total: typeRewards.length,
        claimable: claimable.length,
        claimed: claimed.length,
        totalAmount: typeRewards.reduce((sum, r) => sum + r.amount, 0),
        claimableAmount: claimable.reduce((sum, r) => sum + r.amount, 0),
        claimedAmount: claimed.reduce((sum, r) => sum + r.amount, 0)
      };
      
      return acc;
    }, {});
    
    // 성공 응답 반환
    return res.status(200).json(
      createApiResponse(true, '보상 정보를 성공적으로 조회했습니다', {
        totalRewards,
        claimableRewards,
        rewardHistory: rewards,
        summary: {
          total: rewards.length,
          claimable: claimableRewards.length,
          claimed: rewards.length - claimableRewards.length,
          byType: rewardSummaryByType
        },
        fetchTime: new Date().toISOString()
      })
    );
    
  } catch (error) {
    console.error('getRewards API 오류:', error);
    return res.status(500).json(
      createApiResponse(false, '보상 조회 중 오류가 발생했습니다', null, getErrorMessage(error))
    );
  }
}