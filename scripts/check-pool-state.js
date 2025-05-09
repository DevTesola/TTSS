// check-pool-state.js
const { Connection, PublicKey } = require('@solana/web3.js');

async function checkPoolState() {
  try {
    const poolAddress = '8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP';
    const PROGRAM_ID = '4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs';

    // Solana 연결 설정
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log('Solana 연결 설정 완료');

    // Pool State 계정 정보 가져오기
    console.log(`Pool 주소 ${poolAddress} 확인 중...`);
    const poolStateAccount = await connection.getAccountInfo(new PublicKey(poolAddress));
    
    if (!poolStateAccount) {
      console.log('계정이 존재하지 않습니다');
      return;
    }

    console.log('계정 발견됨:', {
      owner: poolStateAccount.owner.toString(),
      dataLength: poolStateAccount.data.length,
    });

    if (poolStateAccount.owner.toString() !== PROGRAM_ID) {
      console.log(`경고: 계정 소유자가 예상과 다릅니다. 실제: ${poolStateAccount.owner.toString()}, 예상: ${PROGRAM_ID}`);
      return;
    }

    // PoolState 계정인지 데이터 분석
    const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70]; // PoolState 계정 타입 식별자
    
    if (poolStateAccount.data.length < 8) {
      console.log('데이터가 너무 짧습니다', poolStateAccount.data.length);
      return;
    }

    const discriminator = [...poolStateAccount.data.slice(0, 8)];
    console.log('Discriminator:', discriminator);
    const isCorrectDiscriminator = POOL_STATE_DISCRIMINATOR.every((val, idx) => val === discriminator[idx]);
    console.log('올바른 PoolState 계정 타입:', isCorrectDiscriminator);
    
    if (!isCorrectDiscriminator) {
      console.log('이 계정은 PoolState 타입이 아닙니다');
      return;
    }

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
      
      console.log('PoolState 데이터 파싱 성공:', {
        admin: adminPubkey.toString(),
        reward_rate: rewardRate.toString(),
        emergency_fee_percent: emergencyFeePercent,
        paused: paused
      });

      // 테스트를 위한 하드코딩된 관리자 지갑
      const expectedAdmin = 'qNfZ9QHYyu5dDDMvVAZ1hE55JX4GfUYQyfvLzZKBZi3';
      console.log('관리자 일치 여부:', adminPubkey.toString() === expectedAdmin);
    } catch (parseError) {
      console.error('풀 데이터 파싱 오류:', parseError);
    }
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

checkPoolState();