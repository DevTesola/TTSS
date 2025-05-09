// pages/api/admin/update-admin-check.js
// 이 파일은 풀 상태의 현재 관리자를 확인하고 관리자 권한을 테스트하는 API입니다

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { isAdminWallet } from '../../../utils/adminAuth';

// 프로그램 ID와 IDL
const PROGRAM_ID = '4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs';

// update_reward_rate 명령 식별자 (IDL에서 가져온 값)
const UPDATE_REWARD_RATE_DISCRIMINATOR = [105, 157, 0, 185, 21, 144, 163, 159];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 현재 관리자 지갑 확인
    const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES?.split(',')[0]?.trim();
    console.log('Current admin wallet from env:', adminWallet);

    if (!adminWallet) {
      return res.status(400).json({ error: '관리자 지갑 주소가 환경 변수에 설정되지 않았습니다' });
    }

    // 현재 풀 상태 주소 가져오기
    const poolStateAddress = process.env.POOL_STATE_ADDRESS || '8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP';
    console.log('Pool state address:', poolStateAddress);

    // Solana 연결 설정
    const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');

    // 풀 상태 계정 정보 가져오기
    const poolStateAccount = await connection.getAccountInfo(new PublicKey(poolStateAddress));
    
    if (!poolStateAccount) {
      return res.status(404).json({
        exists: false,
        message: '풀 상태 계정이 존재하지 않습니다'
      });
    }

    // 풀 상태 계정의 관리자 주소 확인
    let poolAdmin = null;
    const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70]; // PoolState 계정 타입 식별자
    
    if (poolStateAccount.data.length >= 40) {
      const discriminator = [...poolStateAccount.data.slice(0, 8)];
      const isCorrectDiscriminator = POOL_STATE_DISCRIMINATOR.every((val, idx) => val === discriminator[idx]);
      
      if (isCorrectDiscriminator) {
        try {
          // admin pubkey (32바이트) 추출 - 첫 8바이트 이후 시작
          const adminPubkeyBytes = poolStateAccount.data.slice(8, 40);
          const adminPubkey = new PublicKey(adminPubkeyBytes);
          poolAdmin = adminPubkey.toString();
          console.log('Pool admin from account data:', poolAdmin);
        } catch (parseError) {
          console.error('풀 관리자 정보 파싱 오류:', parseError);
        }
      }
    }

    // 환경변수 관리자와 풀 관리자가 같은지 확인
    const isEnvAdminMatchPoolAdmin = adminWallet === poolAdmin;

    // update_reward_rate 명령을 사용해 관리자 권한 테스트 (시뮬레이션 모드에서만)
    const programId = new PublicKey(PROGRAM_ID);
    const poolStatePubkey = new PublicKey(poolStateAddress);
    const adminPubkey = new PublicKey(adminWallet);
    
    // rewardRate 값을 8바이트 버퍼로 변환 (현재 값 유지를 위해 현재 값과 동일하게 설정)
    const rewardRateBuf = Buffer.alloc(8);
    rewardRateBuf.writeBigUInt64LE(BigInt(100)); // 기본값으로 100 사용
    
    // 명령 데이터 생성
    const instructionData = Buffer.concat([
      Buffer.from(UPDATE_REWARD_RATE_DISCRIMINATOR),
      rewardRateBuf
    ]);
    
    // 계정 배열 구성
    const accounts = [
      { pubkey: adminPubkey, isSigner: true, isWritable: true }, // admin
      { pubkey: poolStatePubkey, isSigner: false, isWritable: true } // pool_state
    ];
    
    // 명령 생성
    const updateRewardRateIx = new TransactionInstruction({
      keys: accounts,
      programId: programId,
      data: instructionData
    });
    
    // 트랜잭션 생성
    const tx = new Transaction().add(updateRewardRateIx);
    tx.feePayer = adminPubkey;
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    
    // 트랜잭션 시뮬레이션 - 관리자 권한이 있는지 확인
    console.log('Simulating transaction to check admin authority...');
    let hasAdminAuthority = false;
    let simulationLogs = [];
    
    try {
      const simulation = await connection.simulateTransaction(tx);
      simulationLogs = simulation.value.logs || [];
      
      // NotAdmin 오류가 있는지 확인
      const hasNotAdminError = simulationLogs.some(log => 
        log.includes('NotAdmin') || log.includes('not the pool admin')
      );
      
      if (!hasNotAdminError && !simulation.value.err) {
        hasAdminAuthority = true;
      } else if (hasNotAdminError) {
        console.log('NotAdmin error detected in simulation logs');
      } else if (simulation.value.err) {
        console.log('Simulation failed with error:', simulation.value.err);
      }
    } catch (simError) {
      console.error('시뮬레이션 오류:', simError);
    }

    // 결과 반환
    return res.status(200).json({
      pool_state: {
        address: poolStateAddress,
        exists: true,
        admin: poolAdmin
      },
      env_admin: adminWallet,
      admin_check: {
        env_admin_matches_pool_admin: isEnvAdminMatchPoolAdmin,
        has_admin_authority: hasAdminAuthority,
        simulation_logs: simulationLogs
      },
      message: isEnvAdminMatchPoolAdmin 
        ? '환경변수의 관리자가 풀 관리자와 일치합니다'
        : '환경변수의 관리자가 풀 관리자와 일치하지 않습니다',
      recommendation: !isEnvAdminMatchPoolAdmin
        ? '환경변수 NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES를 풀 관리자 주소로 변경하거나, 새 풀을 초기화하세요'
        : '관리자 설정이 정상입니다'
    });
  } catch (error) {
    console.error('관리자 확인 중 오류:', error);
    return res.status(500).json({ 
      error: '관리자 확인 실패: ' + (error.message || '알 수 없는 오류'),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}