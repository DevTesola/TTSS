/**
 * 트랜잭션 모니터링 및 로깅을 위한 유틸리티
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
} catch (err) {
  console.error('Supabase 클라이언트 초기화 오류:', err);
}

/**
 * 트랜잭션 정보 로깅
 * 
 * @param {string} transactionType - 트랜잭션 유형 (스테이킹, 언스테이킹, 민팅 등)
 * @param {Object} transactionInfo - 트랜잭션 정보
 * @param {string} walletAddress - 사용자 지갑 주소
 * @param {string} signature - 트랜잭션 서명 (옵션)
 * @param {string} status - 트랜잭션 상태 (준비, 서명됨, 확인됨 등)
 */
async function logTransaction(transactionType, transactionInfo, walletAddress, signature = null, status = 'prepared') {
  // 로깅 비활성화 확인
  if (process.env.DISABLE_TRANSACTION_LOGGING === 'true') {
    return;
  }
  
  // 콘솔에 로깅
  console.log(`[${transactionType}] 트랜잭션 ${status}:`, {
    wallet: walletAddress,
    signature: signature,
    timestamp: new Date().toISOString(),
    ...transactionInfo
  });
  
  // Supabase에 로깅
  if (supabase) {
    try {
      await supabase.from('transaction_logs').insert([{
        transaction_type: transactionType,
        wallet_address: walletAddress,
        signature: signature,
        status: status,
        details: transactionInfo,
        created_at: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('트랜잭션 로그 저장 오류:', err);
      // 로깅 실패는 주요 기능에 영향을 주지 않으므로 오류를 무시
    }
  }
}

/**
 * 트랜잭션 오류 정보 로깅
 * 
 * @param {string} transactionType - 트랜잭션 유형
 * @param {Error} error - 오류 객체
 * @param {string} walletAddress - 사용자 지갑 주소
 * @param {Object} transactionInfo - 추가 트랜잭션 정보
 */
async function logTransactionError(transactionType, error, walletAddress, transactionInfo = {}) {
  // 로깅 비활성화 확인
  if (process.env.DISABLE_TRANSACTION_LOGGING === 'true') {
    return;
  }
  
  // 오류 정보 추출
  const errorInfo = {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
  
  // 콘솔에 로깅
  console.error(`[${transactionType}] 트랜잭션 오류:`, {
    wallet: walletAddress,
    error: errorInfo,
    timestamp: new Date().toISOString(),
    ...transactionInfo
  });
  
  // Supabase에 로깅
  if (supabase) {
    try {
      await supabase.from('transaction_error_logs').insert([{
        transaction_type: transactionType,
        wallet_address: walletAddress,
        error_message: error.message,
        error_code: error.code || 'UNKNOWN_ERROR',
        error_stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        details: transactionInfo,
        created_at: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('트랜잭션 오류 로그 저장 실패:', err);
      // 로깅 실패는 주요 기능에 영향을 주지 않으므로 오류를 무시
    }
  }
}

/**
 * 트랜잭션 서명 정보 기록
 * 
 * @param {string} transactionType - 트랜잭션 유형
 * @param {string} signature - 트랜잭션 서명
 * @param {string} walletAddress - 사용자 지갑 주소
 * @param {Object} transactionInfo - 추가 트랜잭션 정보
 */
async function logTransactionSignature(transactionType, signature, walletAddress, transactionInfo = {}) {
  return logTransaction(transactionType, transactionInfo, walletAddress, signature, 'signed');
}

/**
 * 트랜잭션 확인 정보 기록
 * 
 * @param {string} transactionType - 트랜잭션 유형
 * @param {string} signature - 트랜잭션 서명
 * @param {string} walletAddress - 사용자 지갑 주소
 * @param {Object} confirmationInfo - 확인 정보
 */
async function logTransactionConfirmation(transactionType, signature, walletAddress, confirmationInfo = {}) {
  return logTransaction(transactionType, confirmationInfo, walletAddress, signature, 'confirmed');
}

module.exports = {
  logTransaction,
  logTransactionError,
  logTransactionSignature,
  logTransactionConfirmation
};