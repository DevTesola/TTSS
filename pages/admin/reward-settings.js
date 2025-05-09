import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from '../../components/admin/AdminLayout';

export default function RewardSettings() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  
  // 보상 설정 상태
  const [baseRewardRate, setBaseRewardRate] = useState(100);
  const [timeMultipliers, setTimeMultipliers] = useState([
    { days: 7, multiplier: 105 },   // 7일 후 5% 부스트
    { days: 14, multiplier: 110 },  // 14일 후 10% 부스트
    { days: 30, multiplier: 120 }   // 30일 후 20% 부스트
  ]);
  const [collectionBonuses, setCollectionBonuses] = useState([
    { count: 2, bonusPercent: 10 },  // 2개 NFT = 10% 보너스
    { count: 3, bonusPercent: 20 }   // 3개 NFT = 20% 보너스
  ]);
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [poolStats, setPoolStats] = useState(null);
  
  // 승수 추가 상태
  const [newMultiplierDays, setNewMultiplierDays] = useState(0);
  const [newMultiplierValue, setNewMultiplierValue] = useState(100);
  
  // 컬렉션 보너스 추가 상태
  const [newBonusCount, setNewBonusCount] = useState(0);
  const [newBonusPercent, setNewBonusPercent] = useState(0);
  
  // 설정 로드
  useEffect(() => {
    if (connection && publicKey) {
      loadRewardSettings();
      loadPoolStats();
    }
  }, [connection, publicKey]);
  
  const loadRewardSettings = async () => {
    if (!connection || !publicKey) return;
    
    try {
      setSettingsLoading(true);
      
      // 백엔드에서 현재 보상 설정 가져오기
      const response = await fetch('/api/admin/reward-settings', {
        headers: {
          'X-Wallet-Address': publicKey.toString()
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '설정 로드 실패');
      }
      
      const data = await response.json();
      
      // 상태 업데이트
      setBaseRewardRate(data.baseRewardRate || 100);
      
      if (data.timeMultipliers && Array.isArray(data.timeMultipliers)) {
        setTimeMultipliers(data.timeMultipliers);
      }
      
      if (data.collectionBonuses && Array.isArray(data.collectionBonuses)) {
        setCollectionBonuses(data.collectionBonuses);
      }
      
    } catch (error) {
      console.error('보상 설정 로드 오류:', error);
      toast.error('보상 설정 로드 실패: ' + error.message);
      
      // 로드 실패 시 기본값 사용
      setBaseRewardRate(100);
      setTimeMultipliers([
        { days: 7, multiplier: 105 },
        { days: 14, multiplier: 110 },
        { days: 30, multiplier: 120 }
      ]);
      setCollectionBonuses([
        { count: 2, bonusPercent: 10 },
        { count: 3, bonusPercent: 20 }
      ]);
    } finally {
      setSettingsLoading(false);
    }
  };
  
  const loadPoolStats = async () => {
    if (!connection || !publicKey) return;
    
    try {
      // 풀 통계 가져오기
      const response = await fetch('/api/admin/pool-stats', {
        headers: {
          'X-Wallet-Address': publicKey.toString()
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '통계 로드 실패');
      }
      
      const data = await response.json();
      setPoolStats(data);
      
    } catch (error) {
      console.error('풀 통계 로드 오류:', error);
      toast.error('풀 통계 로드 실패: ' + error.message);
    }
  };
  
  const handleSaveSettings = async () => {
    if (!publicKey || !signTransaction) {
      toast.error('지갑이 연결되지 않았습니다');
      return;
    }
    
    try {
      setIsLoading(true);
      toast.info('설정 저장 중...');
      
      // 일수에 따라 정렬 (오름차순)
      const sortedMultipliers = [...timeMultipliers].sort((a, b) => a.days - b.days);
      
      // NFT 개수에 따라 정렬 (오름차순)
      const sortedBonuses = [...collectionBonuses].sort((a, b) => a.count - b.count);
      
      // 설정 유효성 검사
      if (baseRewardRate <= 0) {
        toast.error('기본 보상 비율은 0보다 커야 합니다');
        return;
      }
      
      // 백엔드에 설정 저장 요청
      const response = await fetch('/api/admin/update-reward-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': publicKey.toString()
        },
        body: JSON.stringify({
          baseRewardRate,
          timeMultipliers: sortedMultipliers,
          collectionBonuses: sortedBonuses
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '설정 저장 실패');
      }
      
      const result = await response.json();
      
      // 트랜잭션이 있는 경우 처리
      if (result.transaction) {
        toast.info('트랜잭션 서명 중...');
        
        // 트랜잭션 디코딩
        const transaction = Transaction.from(
          Buffer.from(result.transaction, 'base64')
        );
        
        // 트랜잭션 서명
        const signedTransaction = await signTransaction(transaction);
        
        // 서명된 트랜잭션 전송
        const signature = await connection.sendRawTransaction(
          signedTransaction.serialize()
        );
        
        toast.info(`트랜잭션 제출됨: ${signature}`);
        
        // 트랜잭션 확인
        await connection.confirmTransaction(signature, 'confirmed');
        toast.success('보상 설정이 성공적으로 저장되었습니다!');
      } else {
        // 트랜잭션 없이 성공한 경우
        toast.success('보상 설정이 성공적으로 저장되었습니다!');
      }
      
      // 설정 다시 로드
      await loadRewardSettings();
      await loadPoolStats();
      
    } catch (error) {
      console.error('설정 저장 오류:', error);
      toast.error(`설정 저장 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 시간 기반 승수 관리 함수
  const addTimeMultiplier = () => {
    if (newMultiplierDays <= 0) {
      toast.error('스테이킹 기간은 0보다 커야 합니다');
      return;
    }
    
    if (newMultiplierValue <= 100) {
      toast.error('시간 승수는 100%보다 커야 합니다');
      return;
    }
    
    // 동일한 일수의 승수가 이미 있는지 확인
    const existing = timeMultipliers.find(m => m.days === newMultiplierDays);
    if (existing) {
      toast.error(`${newMultiplierDays}일 기간의 승수가 이미 존재합니다`);
      return;
    }
    
    setTimeMultipliers([
      ...timeMultipliers,
      { days: newMultiplierDays, multiplier: newMultiplierValue }
    ]);
    
    // 입력 필드 초기화
    setNewMultiplierDays(0);
    setNewMultiplierValue(100);
  };
  
  const removeTimeMultiplier = (index) => {
    setTimeMultipliers(timeMultipliers.filter((_, i) => i !== index));
  };
  
  // 컬렉션 보너스 관리 함수
  const addCollectionBonus = () => {
    if (newBonusCount <= 0) {
      toast.error('NFT 개수는 0보다 커야 합니다');
      return;
    }
    
    if (newBonusPercent <= 0) {
      toast.error('보너스 비율은 0보다 커야 합니다');
      return;
    }
    
    // 동일한 NFT 개수에 대한 보너스가 이미 있는지 확인
    const existing = collectionBonuses.find(b => b.count === newBonusCount);
    if (existing) {
      toast.error(`${newBonusCount}개 NFT에 대한 보너스가 이미 존재합니다`);
      return;
    }
    
    setCollectionBonuses([
      ...collectionBonuses,
      { count: newBonusCount, bonusPercent: newBonusPercent }
    ]);
    
    // 입력 필드 초기화
    setNewBonusCount(0);
    setNewBonusPercent(0);
  };
  
  const removeCollectionBonus = (index) => {
    setCollectionBonuses(collectionBonuses.filter((_, i) => i !== index));
  };
  
  return (
    <AdminLayout title="동적 보상 설정">
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">보상 시스템 설정</h2>
        
        {settingsLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 기본 보상률 */}
            <div>
              <h3 className="text-lg font-medium mb-2">기본 보상 비율</h3>
              <div className="bg-gray-700 p-4 rounded">
                <div className="flex flex-col md:flex-row md:items-center">
                  <label className="mb-2 md:mb-0 md:mr-4 text-gray-300">초당 기본 보상 (토큰 단위):</label>
                  <input
                    type="number"
                    value={baseRewardRate}
                    onChange={(e) => setBaseRewardRate(Number(e.target.value))}
                    className="bg-gray-600 text-white px-3 py-2 rounded w-full md:w-32"
                    min="1"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  스테이킹 1초당 지급되는 기본 토큰 양입니다. 시간 승수와 컬렉션 보너스가 이 값에 적용됩니다.
                </p>
              </div>
            </div>
            
            {/* 시간 기반 승수 */}
            <div>
              <h3 className="text-lg font-medium mb-2">시간 기반 승수</h3>
              <div className="bg-gray-700 p-4 rounded mb-4">
                <p className="text-sm text-gray-300 mb-2">
                  스테이킹 기간에 따른 보상 승수를 설정합니다. 같은 일수에 대한 승수는 하나만 존재할 수 있습니다.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-600">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">스테이킹 기간 (일)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">승수 (%)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-600">
                      {timeMultipliers.sort((a, b) => a.days - b.days).map((multiplier, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{multiplier.days}</td>
                          <td className="px-4 py-2">{multiplier.multiplier}%</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeTimeMultiplier(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex flex-col md:flex-row md:items-end space-y-2 md:space-y-0 md:space-x-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">스테이킹 기간 (일)</label>
                    <input
                      type="number"
                      value={newMultiplierDays}
                      onChange={(e) => setNewMultiplierDays(Number(e.target.value))}
                      className="bg-gray-600 text-white px-3 py-2 rounded w-full md:w-32"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">승수 (%)</label>
                    <input
                      type="number"
                      value={newMultiplierValue}
                      onChange={(e) => setNewMultiplierValue(Number(e.target.value))}
                      className="bg-gray-600 text-white px-3 py-2 rounded w-full md:w-32"
                      min="101"
                    />
                  </div>
                  <button
                    onClick={addTimeMultiplier}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
            
            {/* 컬렉션 보너스 */}
            <div>
              <h3 className="text-lg font-medium mb-2">컬렉션 보너스</h3>
              <div className="bg-gray-700 p-4 rounded mb-4">
                <p className="text-sm text-gray-300 mb-2">
                  스테이킹한 NFT 개수에 따른 보너스를 설정합니다. 같은 개수에 대한 보너스는 하나만 존재할 수 있습니다.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-600">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">NFT 개수</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">보너스 (%)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-600">
                      {collectionBonuses.sort((a, b) => a.count - b.count).map((bonus, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{bonus.count}</td>
                          <td className="px-4 py-2">{bonus.bonusPercent}%</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeCollectionBonus(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 flex flex-col md:flex-row md:items-end space-y-2 md:space-y-0 md:space-x-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">NFT 개수</label>
                    <input
                      type="number"
                      value={newBonusCount}
                      onChange={(e) => setNewBonusCount(Number(e.target.value))}
                      className="bg-gray-600 text-white px-3 py-2 rounded w-full md:w-32"
                      min="2"
                      max="3"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">보너스 (%)</label>
                    <input
                      type="number"
                      value={newBonusPercent}
                      onChange={(e) => setNewBonusPercent(Number(e.target.value))}
                      className="bg-gray-600 text-white px-3 py-2 rounded w-full md:w-32"
                      min="1"
                      max="100"
                    />
                  </div>
                  <button
                    onClick={addCollectionBonus}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    추가
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  최대 NFT 개수는 3개로 제한됩니다.
                </p>
              </div>
            </div>
            
            {/* 저장 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={isLoading}
                className={`px-6 py-2 rounded font-semibold text-white ${
                  isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isLoading ? '저장 중...' : '설정 저장'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 풀 통계 */}
      {poolStats && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">스테이킹 풀 통계</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-sm font-medium text-gray-400 mb-1">총 스테이킹 NFT</h3>
              <p className="text-2xl font-bold">{poolStats.totalStakedNfts || 0}</p>
            </div>
            
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-sm font-medium text-gray-400 mb-1">활성 스테이커</h3>
              <p className="text-2xl font-bold">{poolStats.activeStakers || 0}</p>
            </div>
            
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-sm font-medium text-gray-400 mb-1">누적 보상 지급량</h3>
              <p className="text-2xl font-bold">{poolStats.totalRewardsPaid || 0} TESOLA</p>
            </div>
          </div>
          
          {poolStats.topStakers && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">최다 스테이킹 지갑</h3>
              <div className="bg-gray-700 p-4 rounded overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-600">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">지갑 주소</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">스테이킹 NFT 수</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">획득 보상</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600">
                    {poolStats.topStakers.map((staker, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 font-mono text-sm">{staker.wallet}</td>
                        <td className="px-4 py-2">{staker.nftCount}</td>
                        <td className="px-4 py-2">{staker.totalRewards} TESOLA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {poolStats.recentActivity && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">최근 활동</h3>
              <div className="bg-gray-700 p-4 rounded overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-600">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">시간</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">활동</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">지갑</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">상세 정보</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600">
                    {poolStats.recentActivity.map((activity, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">{new Date(activity.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          {activity.type === 'claim' && <span className="text-green-400">보상 청구</span>}
                          {activity.type === 'stake' && <span className="text-blue-400">스테이킹</span>}
                          {activity.type === 'unstake' && <span className="text-yellow-400">언스테이킹</span>}
                        </td>
                        <td className="px-4 py-2 font-mono text-sm">{activity.wallet.slice(0, 4)}...{activity.wallet.slice(-4)}</td>
                        <td className="px-4 py-2">
                          {activity.type === 'claim' && <span>{activity.amount} TESOLA</span>}
                          {activity.type === 'stake' && <span>{activity.nftCount}개 NFT</span>}
                          {activity.type === 'unstake' && <span>{activity.nftCount}개 NFT</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      
      <ToastContainer position="bottom-right" theme="dark" />
    </AdminLayout>
  );
}