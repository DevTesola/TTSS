/**
 * claimRewards.js - 사용자 스테이킹 리워드 청구 API
 * 
 * 사용자가 획득한 스테이킹 리워드를 청구하는 API 엔드포인트
 * - 사용자의 청구 가능한 리워드 조회
 * - 리워드 청구 요청 생성
 * - 리워드 상태 업데이트
 */

import { getSupabase } from '../../../shared/utils/supabase';
import { createApiResponse, getErrorMessage } from '../../../shared/utils/error-handler';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json(
      createApiResponse(false, 'Method Not Allowed', null, 'Only POST requests are allowed')
    );
  }
  
  try {
    const { wallet } = req.body;
    
    // 필수 입력값 검증
    if (!wallet) {
      return res.status(400).json(
        createApiResponse(false, 'Wallet 주소가 필요합니다', null, 'Wallet address is required')
      );
    }
    
    // Supabase 클라이언트 초기화
    const supabase = getSupabase();
    
    // 사용자의 청구 가능한 리워드 조회
    const { data: rewards, error: fetchError } = await supabase
      .from('rewards')
      .select('id, amount, reward_type, reference_id')
      .eq('wallet_address', wallet)
      .eq('claimed', false);
    
    if (fetchError) {
      console.error('리워드 조회 오류:', fetchError);
      return res.status(500).json(
        createApiResponse(false, '리워드 조회에 실패했습니다', null, getErrorMessage(fetchError))
      );
    }
    
    // 청구할 리워드가 없는 경우
    if (!rewards || rewards.length === 0) {
      return res.status(400).json(
        createApiResponse(false, '청구 가능한 리워드가 없습니다', null, 'No claimable rewards found')
      );
    }
    
    // 리워드 타입별 분류
    const rewardsByType = rewards.reduce((acc, reward) => {
      const type = reward.reward_type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(reward);
      return acc;
    }, {});
    
    // 총 청구 금액 계산
    const totalAmount = rewards.reduce((sum, reward) => sum + reward.amount, 0);
    
    // 청구 요청 생성
    const { data: claim, error: claimError } = await supabase
      .from('reward_claims')
      .insert([
        {
          wallet_address: wallet,
          amount: totalAmount,
          status: 'pending',
          reward_types: Object.keys(rewardsByType),
          reward_count: rewards.length,
          details: JSON.stringify(rewardsByType)
        }
      ])
      .select()
      .single();
    
    if (claimError) {
      console.error('청구 요청 생성 오류:', claimError);
      return res.status(500).json(
        createApiResponse(false, '청구 요청 생성에 실패했습니다', null, getErrorMessage(claimError))
      );
    }
    
    // 리워드를 청구됨으로 표시
    const rewardIds = rewards.map(r => r.id);
    const { error: updateError } = await supabase
      .from('rewards')
      .update({ 
        claimed: true, 
        updated_at: new Date().toISOString(),
        claim_id: claim.id
      })
      .in('id', rewardIds);
    
    if (updateError) {
      console.error('리워드 상태 업데이트 오류:', updateError);
      return res.status(500).json(
        createApiResponse(false, '리워드 상태 업데이트에 실패했습니다', null, getErrorMessage(updateError))
      );
    }
    
    // 성공 응답
    return res.status(200).json(
      createApiResponse(true, '리워드 청구 요청이 성공적으로 생성되었습니다', {
        claim: {
          id: claim.id,
          amount: totalAmount,
          status: 'pending',
          created_at: claim.created_at,
          reward_count: rewards.length,
          reward_types: Object.keys(rewardsByType).join(', ')
        }
      })
    );
    
  } catch (error) {
    console.error('claimRewards API 오류:', error);
    return res.status(500).json(
      createApiResponse(false, '리워드 청구 중 오류가 발생했습니다', null, getErrorMessage(error))
    );
  }
}