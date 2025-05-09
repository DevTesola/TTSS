// pages/api/admin/reward-settings.js
import { isAdminWallet } from '../../../utils/adminAuth';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../../../utils/cluster';

// 초기 보상 설정 정의
const DEFAULT_SETTINGS = {
  baseRewardRate: 100,
  timeMultipliers: [
    { days: 7, multiplier: 105 },   // 5% boost after 7 days
    { days: 14, multiplier: 110 },  // 10% boost after 14 days
    { days: 30, multiplier: 120 }   // 20% boost after 30 days
  ],
  collectionBonuses: [
    { count: 2, bonusPercent: 10 },  // 10% bonus for 2 NFTs
    { count: 3, bonusPercent: 20 }   // 20% bonus for 3 NFTs
  ]
};

/**
 * 현재 리워드 설정을 반환하는 API 엔드포인트
 */
export default async function handler(req, res) {
  // GET 요청만 허용
  if (req.method !== 'GET') {
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
    
    // Solana 연결 설정
    const connection = getConnection();
    
    // 프로그램 ID
    const PROGRAM_ID = new PublicKey('4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs');
    
    // 풀 상태 PDA 주소 계산
    const [poolStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_state')],
      PROGRAM_ID
    );
    
    // 풀 상태 계정 정보 가져오기
    try {
      const accountInfo = await connection.getAccountInfo(poolStatePDA);
      
      if (!accountInfo || !accountInfo.owner.equals(PROGRAM_ID)) {
        console.log('Pool state account not found or not owned by program');
        return res.status(200).json(DEFAULT_SETTINGS);
      }
      
      // 실제 구현에서는 여기서 계정 데이터를 파싱해야 함
      // 현재는 기본값을 반환
      return res.status(200).json(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Error fetching pool state account:', error);
      return res.status(200).json(DEFAULT_SETTINGS);
    }
  } catch (error) {
    console.error('Error in reward-settings endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch reward settings' });
  }
}