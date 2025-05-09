/**
 * completeClaimRewards.js - 온체인 리워드 청구 완료 API
 * 
 * 온체인에서 리워드 청구 트랜잭션이 성공적으로 처리된 후 데이터베이스를 업데이트하는 API
 */

import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';

// 수파베이스 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // 읽기/쓰기 권한 필요
);

// Solana RPC 엔드포인트
const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    const { wallet, signature, mintAddress, claimId } = req.body;
    
    if (!wallet || !signature) {
      return res.status(400).json({ 
        error: 'Wallet address and transaction signature are required',
        success: false 
      });
    }
    
    console.log('Completing claim rewards process with:', { wallet, signature, mintAddress, claimId });
    
    // 트랜잭션 확인
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    const txInfo = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (!txInfo) {
      return res.status(404).json({
        error: 'Transaction not found on the blockchain',
        success: false
      });
    }
    
    if (txInfo.meta.err) {
      return res.status(400).json({
        error: 'Transaction failed on the blockchain',
        details: txInfo.meta.err,
        success: false
      });
    }
    
    console.log('Transaction verified successfully:', signature);
    
    // 청구 기록 업데이트
    if (claimId) {
      const { error: updateClaimError } = await supabase
        .from('reward_claims')
        .update({
          status: 'completed',
          confirmed_at: new Date().toISOString(),
          tx_signature: signature
        })
        .eq('id', claimId);
      
      if (updateClaimError) {
        console.error('Error updating claim record:', updateClaimError);
      }
    }
    
    // NFT 스테이킹 기록 업데이트
    if (mintAddress) {
      const { data: stakingRecord, error: stakingError } = await supabase
        .from('nft_staking')
        .select('*')
        .eq('wallet_address', wallet)
        .eq('mint_address', mintAddress)
        .eq('status', 'staked')
        .single();
      
      if (stakingError) {
        console.error('Error fetching staking record:', stakingError);
      } else if (stakingRecord) {
        // 마지막 청구 시간 업데이트
        const { error: updateStakingError } = await supabase
          .from('nft_staking')
          .update({
            last_claim_time: new Date().toISOString(),
            last_claim_tx: signature,
            updated_at: new Date().toISOString()
          })
          .eq('id', stakingRecord.id);
        
        if (updateStakingError) {
          console.error('Error updating staking record:', updateStakingError);
        }
      }
    }
    
    // 트랜잭션 로그 기록
    const { error: txLogError } = await supabase
      .from('transactions')
      .insert([{
        wallet_address: wallet,
        mint_address: mintAddress,
        tx_signature: signature,
        tx_type: 'claim_rewards',
        status: 'completed',
        timestamp: new Date().toISOString(),
        details: {
          claimId,
          blockTime: txInfo.blockTime
        }
      }]);
    
    if (txLogError) {
      console.error('Error logging transaction:', txLogError);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Rewards claimed successfully',
      transaction: {
        signature,
        blockTime: txInfo.blockTime
      }
    });
  } catch (error) {
    console.error('Error in completeClaimRewards API:', error);
    return res.status(500).json({
      error: 'Failed to complete claim rewards process: ' + error.message,
      success: false
    });
  }
}