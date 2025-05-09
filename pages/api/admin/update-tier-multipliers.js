// pages/api/admin/update-tier-multipliers.js
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// 프로그램 ID와 IDL
const PROGRAM_ID = '4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs';

// update_tier_multipliers 명령 식별자 (IDL에서 가져온 값)
const UPDATE_TIER_MULTIPLIERS_DISCRIMINATOR = [25, 132, 162, 53, 130, 129, 248, 23];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 환경변수에서 관리자 지갑 가져오기
    const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES?.split(',')[0]?.trim();
    
    if (!adminWallet) {
      return res.status(400).json({ error: '관리자 지갑 주소가 환경 변수에 설정되지 않았습니다' });
    }
    
    // 현재 풀 상태 주소 가져오기
    const poolStateAddress = process.env.POOL_STATE_ADDRESS || '8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP';
    console.log('Using pool state address:', poolStateAddress);
    
    // 요청 매개변수 확인
    const { common, rare, epic, legendary } = req.body;
    
    if (common === undefined || rare === undefined || epic === undefined || legendary === undefined) {
      return res.status(400).json({ error: '모든 등급 승수 값이 필요합니다' });
    }
    
    // 각 승수를 8바이트 버퍼로 변환 (u64)
    const commonBuf = Buffer.alloc(8);
    commonBuf.writeBigUInt64LE(BigInt(common));
    
    const rareBuf = Buffer.alloc(8);
    rareBuf.writeBigUInt64LE(BigInt(rare));
    
    const epicBuf = Buffer.alloc(8);
    epicBuf.writeBigUInt64LE(BigInt(epic));
    
    const legendaryBuf = Buffer.alloc(8);
    legendaryBuf.writeBigUInt64LE(BigInt(legendary));
    
    // 명령 데이터 구성
    const instructionData = Buffer.concat([
      Buffer.from(UPDATE_TIER_MULTIPLIERS_DISCRIMINATOR),
      commonBuf,
      rareBuf,
      epicBuf,
      legendaryBuf
    ]);
    
    // Solana 연결 설정
    const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    
    // 프로그램 ID와 계정 주소 생성
    const programId = new PublicKey(PROGRAM_ID);
    const poolStatePubkey = new PublicKey(poolStateAddress);
    const adminPubkey = new PublicKey(adminWallet);
    
    // 계정 배열 구성
    const accounts = [
      { pubkey: adminPubkey, isSigner: true, isWritable: true }, // admin
      { pubkey: poolStatePubkey, isSigner: false, isWritable: true } // pool_state
    ];
    
    // 트랜잭션 명령 생성
    const updateTierMultipliersIx = new TransactionInstruction({
      keys: accounts,
      programId: programId,
      data: instructionData
    });
    
    // 새 트랜잭션 생성
    const tx = new Transaction();
    tx.add(updateTierMultipliersIx);
    
    // 블록해시 및 트랜잭션 속성 설정
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminPubkey;
    
    // 트랜잭션 시뮬레이션 (디버깅용)
    console.log('Simulating transaction...');
    try {
      const simulation = await connection.simulateTransaction(tx);
      
      if (simulation.value.err) {
        console.error('시뮬레이션 오류:', simulation.value.err);
        
        // NotAdmin 오류 확인
        const simulationLogs = simulation.value.logs || [];
        const hasNotAdminError = simulationLogs.some(log => 
          log.includes('NotAdmin') || log.includes('not the pool admin')
        );
        
        if (hasNotAdminError) {
          return res.status(403).json({ 
            error: '관리자 권한이 없습니다. 관리자 지갑 주소가 올바른지 확인하세요.',
            currentAdmin: adminWallet,
            simulationLogs
          });
        }
      } else {
        console.log('시뮬레이션 성공! 트랜잭션이 성공적으로 실행될 것으로 예상됩니다.');
      }
      
      if (simulation.value.logs) {
        console.log('시뮬레이션 로그:');
        simulation.value.logs.slice(0, 5).forEach(log => console.log(log));
      }
    } catch (simError) {
      console.error('시뮬레이션 실행 오류:', simError);
    }
    
    // 트랜잭션 직렬화
    const serializedTransaction = tx.serialize({ 
      requireAllSignatures: false,
      verifySignatures: false 
    });
    
    // 응답 반환
    return res.status(200).json({
      transactionBase64: serializedTransaction.toString('base64'),
      message: '등급 승수 업데이트 트랜잭션이 생성되었습니다. 관리자 지갑으로 서명하여 실행하세요.',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      multiplierSettings: {
        common,
        rare,
        epic,
        legendary
      }
    });
  } catch (error) {
    console.error('등급 승수 업데이트 트랜잭션 준비 중 오류:', error);
    return res.status(500).json({ 
      error: '등급 승수 업데이트 트랜잭션 준비 실패: ' + (error.message || '알 수 없는 오류'),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}