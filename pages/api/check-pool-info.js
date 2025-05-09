// pages/api/check-pool-info.js
import { Connection, PublicKey } from '@solana/web3.js';

export default async function handler(req, res) {
  try {
    const poolAddress = '8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP';
    const PROGRAM_ID = '4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs';

    // 관리자 지갑을 환경변수에서 가져옴
    const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES?.split(',')[0]?.trim();
    console.log('Expected admin wallet from environment:', adminWallet);
    
    // Solana 연결 설정
    const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');

    // Pool State 계정 정보 가져오기
    const poolStateAccount = await connection.getAccountInfo(new PublicKey(poolAddress));
    
    if (!poolStateAccount) {
      return res.status(404).json({
        exists: false,
        message: '계정이 존재하지 않습니다'
      });
    }

    // PoolState 계정인지 데이터 분석
    let isPoolStateAccount = false;
    let poolData = {};
    
    // PoolState 계정 데이터 구조 분석 (idl/nft_staking.json에서 PoolState discriminator 확인)
    const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70]; // PoolState 계정 타입 식별자
    
    if (poolStateAccount.data.length >= 8) {
      const discriminator = [...poolStateAccount.data.slice(0, 8)];
      const isCorrectDiscriminator = POOL_STATE_DISCRIMINATOR.every((val, idx) => val === discriminator[idx]);
      isPoolStateAccount = isCorrectDiscriminator;
      
      if (isPoolStateAccount) {
        try {
          // admin pubkey (32바이트) 추출 - 첫 8바이트 이후 시작
          const adminPubkeyBytes = poolStateAccount.data.slice(8, 40);
          const adminPubkey = new PublicKey(adminPubkeyBytes);
          
          // reward_rate (8바이트 u64) 추출
          const rewardRateBytes = poolStateAccount.data.slice(40, 48);
          const rewardRate = rewardRateBytes.readBigUInt64LE(0);
          
          // emergency_fee_percent (1바이트 u8) 추출
          const emergencyFeePercent = poolStateAccount.data[48];
          
          // paused (1바이트 bool) 추출
          const paused = poolStateAccount.data[49] !== 0;
          
          poolData = {
            admin: adminPubkey.toString(),
            reward_rate: rewardRate.toString(),
            emergency_fee_percent: emergencyFeePercent,
            paused: paused
          };
        } catch (parseError) {
          console.error('풀 데이터 파싱 오류:', parseError);
          poolData = { parseError: parseError.message };
        }
      }
    }
    
    // 관리자 지갑 일치 여부 확인
    const isAdminMatch = adminWallet && poolData.admin === adminWallet;
    
    // 계정 정보 반환
    return res.status(200).json({
      exists: true,
      address: poolAddress,
      owner: poolStateAccount.owner.toString(),
      expectedOwner: PROGRAM_ID,
      initialized: poolStateAccount.owner.toString() === PROGRAM_ID,
      isPoolStateAccount: isPoolStateAccount,
      poolData: poolData,
      adminMatches: isAdminMatch,
      expectedAdmin: adminWallet || 'Not set in environment',
      lamports: poolStateAccount.lamports,
      dataLength: poolStateAccount.data.length,
      executable: poolStateAccount.executable,
      rentEpoch: poolStateAccount.rentEpoch,
      rawData: {
        hex: poolStateAccount.data.toString('hex').substring(0, 100) + '...',
        discriminator: [...poolStateAccount.data.slice(0, 8)]
      }
    });
  } catch (error) {
    console.error('Pool state 확인 중 오류:', error);
    return res.status(500).json({ 
      error: 'Pool state 확인 실패: ' + (error.message || '알 수 없는 오류'),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}