// pages/api/admin/update-reward-settings.js
import { isAdminWallet } from '../../../utils/adminAuth';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getConnection } from '../../../utils/cluster';
import bs58 from 'bs58';

/**
 * 리워드 설정을 업데이트하는 API 엔드포인트
 */
export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // 요청 헤더에서 지갑 주소 가져오기
    const walletAddress = req.headers['x-wallet-address'];
    
    if (!walletAddress) {
      return res.status(401).json({ error: 'Missing wallet address' });
    }
    
    // 관리자 권한 확인
    if (!isAdminWallet(walletAddress)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // 요청 본문에서 보상 설정 파라미터 가져오기
    const { baseRewardRate, timeMultipliers, collectionBonuses } = req.body;
    
    if (baseRewardRate === undefined || !timeMultipliers || !collectionBonuses) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Solana 연결 설정
    const connection = getConnection();
    
    // 프로그램 ID
    const PROGRAM_ID = new PublicKey('4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs');
    
    // 풀 상태 PDA 주소 계산
    const [poolStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_state')],
      PROGRAM_ID
    );
    
    // 시간 기반 승수 파라미터 계산
    const maxMultiplier = Math.max(...timeMultipliers.map(tm => tm.multiplier - 100)) * 100; // 기준점 = 100%
    const multiplierPeriod = Math.min(...timeMultipliers.map(tm => tm.days));
    const incrementPerPeriod = timeMultipliers.find(tm => tm.days === multiplierPeriod)?.multiplier;
    
    try {
      // 트랜잭션 생성 (프론트엔드에서 서명할 버전)
      // 이 부분은 실제 구현에서 온체인 프로그램에 맞게 수정 필요
      
      // 관리자 계정
      const feePayer = new PublicKey(walletAddress);
      
      // 새 트랜잭션 생성
      const transaction = new Transaction();
      
      // 최신 블록해시 가져오기
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = feePayer;
      
      // 실제 구현에서는 여기에 트랜잭션 명령어 추가
      // 현재는 빈 트랜잭션 반환 (모의 구현)
      
      // 트랜잭션 직렬화
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      
      // Base64 인코딩
      const base64Transaction = serializedTransaction.toString('base64');
      
      // 트랜잭션 응답 반환
      return res.status(200).json({
        success: true,
        message: '보상 설정 트랜잭션 생성 완료',
        transaction: base64Transaction,
        // 파라미터도 함께 반환 (디버깅 및 확인용)
        params: {
          baseRewardRate,
          maxMultiplier,
          multiplierPeriod,
          incrementPerPeriod,
          collectionBonuses
        }
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }
  } catch (error) {
    console.error('Error in update-reward-settings endpoint:', error);
    return res.status(500).json({ error: 'Failed to update reward settings' });
  }
}