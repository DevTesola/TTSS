// pages/api/admin/pool-stats.js
import { isAdminWallet } from '../../../utils/adminAuth';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../../../utils/cluster';

/**
 * 스테이킹 풀 통계를 반환하는 API 엔드포인트
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
    
    try {
      // 온체인에서 풀 통계 계정 정보 가져오기 (실제 구현에선 풀 상태 계정 바이너리 데이터를 파싱)
      // 현재는 모의 데이터 반환
      
      // 모의 데이터 생성
      const mockPoolStats = {
        totalStakedNfts: 87,
        activeStakers: 42,
        totalRewardsPaid: 156789,
        stakingValueLocked: 321000,
        averageStakingDuration: 35, // 일
        topStakers: [
          { wallet: walletAddress, nftCount: 3, totalRewards: 12500 },
          { wallet: "Ae9Ld2P9U9Mzp65TZcHQPvL3pR8o9HkfXXLeEkXqaWRv", nftCount: 3, totalRewards: 10750 },
          { wallet: "5WZ8pZi8pvvHT9FBXXigyyCS9P5hw2Np1L5yNZaYBHgY", nftCount: 2, totalRewards: 8900 },
          { wallet: "FmQkudu3CyNE5J6F7EsJkYSCnZgtxhpWobXjQZKNEDan", nftCount: 2, totalRewards: 7600 },
          { wallet: "3UMXW2HHwPZ5GgP2T8GrhCbP9YmpWCX5qk9A7n95eCLK", nftCount: 1, totalRewards: 4200 }
        ],
        recentActivity: [
          { type: "claim", wallet: walletAddress, amount: 250, timestamp: Date.now() - 3600000 },
          { type: "stake", wallet: "Ae9Ld2P9U9Mzp65TZcHQPvL3pR8o9HkfXXLeEkXqaWRv", nftCount: 1, timestamp: Date.now() - 7200000 },
          { type: "claim", wallet: "5WZ8pZi8pvvHT9FBXXigyyCS9P5hw2Np1L5yNZaYBHgY", amount: 520, timestamp: Date.now() - 10800000 },
          { type: "unstake", wallet: "FmQkudu3CyNE5J6F7EsJkYSCnZgtxhpWobXjQZKNEDan", nftCount: 1, timestamp: Date.now() - 14400000 }
        ]
      };
      
      return res.status(200).json(mockPoolStats);
    } catch (error) {
      console.error('Error fetching pool statistics:', error);
      return res.status(500).json({ error: 'Failed to fetch pool statistics' });
    }
  } catch (error) {
    console.error('Error in pool-stats endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch pool statistics' });
  }
}