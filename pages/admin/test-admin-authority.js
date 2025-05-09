import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from '../../components/admin/AdminLayout';

export default function TestAdminAuthority() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [multiplierSettings, setMultiplierSettings] = useState({
    common: 100,   // 기본값 1.0x
    rare: 200,     // 기본값 2.0x
    epic: 400,     // 기본값 4.0x
    legendary: 800 // 기본값 8.0x
  });
  
  // 관리자 정보 확인
  useEffect(() => {
    if (connection && publicKey) {
      checkAdminStatus();
    }
  }, [connection, publicKey]);
  
  const checkAdminStatus = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/admin/update-admin-check');
      if (!response.ok) {
        throw new Error('관리자 정보 확인 실패');
      }
      
      const data = await response.json();
      setAdminInfo(data);
      
      // 관리자 권한 문제 알림
      if (!data.admin_check.env_admin_matches_pool_admin) {
        toast.warn('환경변수의 관리자가 풀 관리자와 일치하지 않습니다.');
      }
      
      if (!data.admin_check.has_admin_authority) {
        toast.error('현재 지갑에 관리자 권한이 없습니다.');
      }
    } catch (error) {
      console.error('관리자 상태 확인 오류:', error);
      toast.error('관리자 상태 확인 중 오류 발생: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e, field) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setMultiplierSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  
  const handleTestAdminAuthority = async () => {
    if (!publicKey || !signTransaction || !connection) {
      toast.error('지갑이 연결되지 않았습니다');
      return;
    }
    
    try {
      setIsLoading(true);
      
      toast.info('등급 승수 업데이트 트랜잭션 생성 중...');
      
      // API에 등급 승수 업데이트 트랜잭션 요청
      const response = await fetch('/api/admin/update-tier-multipliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': publicKey.toString()
        },
        body: JSON.stringify(multiplierSettings)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '등급 승수 업데이트 트랜잭션 생성 실패');
      }
      
      const { transactionBase64 } = await response.json();
      
      // 트랜잭션 직렬화 버퍼로 변환
      const transactionBuffer = Buffer.from(transactionBase64, 'base64');
      
      // 트랜잭션 객체로 변환
      const transaction = Transaction.from(transactionBuffer);
      
      toast.info('트랜잭션 서명 중...');
      
      // 트랜잭션에 서명
      const signedTransaction = await signTransaction(transaction);
      
      // 트랜잭션 전송
      toast.info('트랜잭션 전송 중...');
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      );
      
      toast.info(`트랜잭션 제출됨: ${signature}`);
      
      // 트랜잭션 확인
      toast.info('트랜잭션 확인 중...');
      try {
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          console.error('트랜잭션 오류:', confirmation.value.err);
          toast.error('관리자 권한 테스트 실패: 트랜잭션 오류');
        } else {
          toast.success('관리자 권한 테스트 성공! 등급 승수가 업데이트되었습니다.');
          // 관리자 정보 다시 확인
          setTimeout(checkAdminStatus, 2000);
        }
      } catch (confirmError) {
        console.error('트랜잭션 확인 오류:', confirmError);
        toast.warn('트랜잭션이 제출되었으나 확인할 수 없습니다.');
      }
    } catch (error) {
      console.error('관리자 권한 테스트 오류:', error);
      toast.error(`관리자 권한 테스트 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <AdminLayout title="관리자 권한 테스트">
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">관리자 계정 정보</h2>
          <button 
            onClick={checkAdminStatus} 
            disabled={isLoading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            {isLoading ? '확인 중...' : '상태 새로 확인'}
          </button>
        </div>
        
        {adminInfo ? (
          <div className="space-y-3">
            <p>
              <span className="font-semibold text-gray-400">풀 관리자 주소:</span>{' '}
              <span className="font-mono">{adminInfo.pool_state.admin}</span>
              {adminInfo.pool_state.admin === publicKey?.toString() && (
                <span className="ml-2 bg-green-600 px-2 py-0.5 rounded text-xs">현재 지갑</span>
              )}
            </p>
            
            <p>
              <span className="font-semibold text-gray-400">환경변수 관리자 주소:</span>{' '}
              <span className="font-mono">{adminInfo.env_admin}</span>
              {adminInfo.env_admin === publicKey?.toString() && (
                <span className="ml-2 bg-green-600 px-2 py-0.5 rounded text-xs">현재 지갑</span>
              )}
            </p>
            
            <p>
              <span className="font-semibold text-gray-400">현재 연결된 지갑:</span>{' '}
              <span className="font-mono">{publicKey?.toString()}</span>
            </p>
            
            <p>
              <span className="font-semibold text-gray-400">관리자 일치 여부:</span>{' '}
              {adminInfo.admin_check.env_admin_matches_pool_admin ? (
                <span className="text-green-400">✓ 일치</span>
              ) : (
                <span className="text-red-400">✗ 불일치</span>
              )}
            </p>
            
            <p>
              <span className="font-semibold text-gray-400">관리자 권한 확인:</span>{' '}
              {adminInfo.admin_check.has_admin_authority ? (
                <span className="text-green-400">✓ 권한 있음</span>
              ) : (
                <span className="text-red-400">✗ 권한 없음</span>
              )}
            </p>
            
            {!adminInfo.admin_check.env_admin_matches_pool_admin && (
              <div className="bg-yellow-800 p-3 rounded mt-2 text-sm">
                <p className="font-semibold">권장 조치:</p>
                <p>{adminInfo.recommendation}</p>
              </div>
            )}
            
            {adminInfo.admin_check.simulation_logs && adminInfo.admin_check.simulation_logs.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold text-gray-300 mb-2">시뮬레이션 로그:</p>
                <pre className="bg-gray-900 p-3 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                  {adminInfo.admin_check.simulation_logs.join('\n')}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p>관리자 정보 로딩 중...</p>
        )}
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">등급 승수 테스트</h2>
        <p className="text-sm text-gray-300 mb-4">
          다음 등급 승수를 업데이트하는 트랜잭션을 생성하여 관리자 권한을 테스트합니다.
          트랜잭션이 성공하면 관리자 권한이 있는 것입니다.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-gray-400 text-sm font-semibold mb-2">
              일반 (Common) 승수
            </label>
            <input 
              type="number" 
              value={multiplierSettings.common}
              onChange={(e) => handleInputChange(e, 'common')}
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
              min="1"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm font-semibold mb-2">
              희귀 (Rare) 승수
            </label>
            <input 
              type="number" 
              value={multiplierSettings.rare}
              onChange={(e) => handleInputChange(e, 'rare')}
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
              min="1"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm font-semibold mb-2">
              에픽 (Epic) 승수
            </label>
            <input 
              type="number" 
              value={multiplierSettings.epic}
              onChange={(e) => handleInputChange(e, 'epic')}
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
              min="1"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm font-semibold mb-2">
              전설 (Legendary) 승수
            </label>
            <input 
              type="number" 
              value={multiplierSettings.legendary}
              onChange={(e) => handleInputChange(e, 'legendary')}
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
              min="1"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <button
          onClick={handleTestAdminAuthority}
          disabled={isLoading || !publicKey}
          className={`px-4 py-2 rounded font-semibold ${
            isLoading || !publicKey
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } transition-colors`}
        >
          {isLoading ? '테스트 중...' : '관리자 권한 테스트'}
        </button>
        
        {!publicKey && (
          <p className="text-sm text-red-400 mt-2">
            지갑을 연결하세요.
          </p>
        )}
      </div>
      
      <ToastContainer position="bottom-right" theme="dark" />
    </AdminLayout>
  );
}