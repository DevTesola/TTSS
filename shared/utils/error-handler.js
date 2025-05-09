/**
 * NFT 스테이킹 프로그램 에러 처리 유틸리티
 * 다양한 오류 유형을 일관된 방식으로 처리하는 함수들
 */

const { ERROR_CODES, SOLANA_ERROR_CODES, CLIENT_ERROR_CODES } = require('./error-codes');

/**
 * 오류 객체에서 사용자 친화적인 메시지 추출
 * 다양한 유형의 오류를 처리하고 일관된 메시지 반환
 * 
 * @param {Error|Object} error - 처리할 오류 객체
 * @returns {string} 사용자 친화적 오류 메시지
 */
function getErrorMessage(error) {
  // Anchor 프로그램 오류인 경우 (errorCode 속성 포함)
  if (error && error.error && error.error.errorCode) {
    const code = error.error.errorCode.number;
    if (ERROR_CODES[code]) {
      return ERROR_CODES[code].message;
    }
  }
  
  // 트랜잭션 시뮬레이션 오류 (로그 포함)
  if (error && error.logs) {
    // 로그에서 오류 코드 패턴 찾기
    for (const log of error.logs) {
      if (log.includes('Error Code:')) {
        // 예: "Error Code: StakingPeriodNotCompleted. Error Number: 6004"
        const match = log.match(/Error Number: (\d+)/);
        if (match && match[1] && ERROR_CODES[parseInt(match[1])]) {
          return ERROR_CODES[parseInt(match[1])].message;
        }
      }
    }
  }
  
  // 일반적인 Solana 오류 처리
  if (error && typeof error === 'object') {
    // 솔라나 에러 코드 확인
    if (error.code && SOLANA_ERROR_CODES[error.code]) {
      return SOLANA_ERROR_CODES[error.code].message;
    }
    
    // 클라이언트 에러 코드 확인
    for (const [errorType, errorInfo] of Object.entries(CLIENT_ERROR_CODES)) {
      if (error.code === errorType) {
        return errorInfo.message;
      }
    }
    
    // 에러 메시지 내용 분석
    if (error.message) {
      // 자금 부족 오류
      if (error.message.includes('insufficient funds') || error.message.includes('0x1')) {
        return CLIENT_ERROR_CODES.InsufficientFunds.message;
      }
      
      // 네트워크 연결 오류
      if (error.message.includes('failed to fetch') || error.message.includes('network')) {
        return CLIENT_ERROR_CODES.NetworkError.message;
      }
      
      // 블록해시 만료 오류
      if (error.message.includes('blockhash')) {
        return CLIENT_ERROR_CODES.BlockhashExpired.message;
      }
      
      // 시뮬레이션 오류
      if (error.message.includes('simulation failed') || error.message.includes('SimulationError')) {
        return CLIENT_ERROR_CODES.SimulationError.message;
      }
    }
  }
  
  // 기본 오류 메시지 (fallback)
  return error?.message || '알 수 없는 오류가 발생했습니다';
}

/**
 * 트랜잭션 처리 및 오류 처리 도우미 함수
 * 트랜잭션 약속을 처리하고 결과를 구조화된 객체로 반환
 * 
 * @param {Promise} transactionPromise - 처리할 트랜잭션 약속
 * @param {string} successMessage - 성공 시 표시할 메시지
 * @returns {Object} 성공/실패 상태와 메시지를 포함한 결과 객체
 */
async function handleTransaction(transactionPromise, successMessage) {
  try {
    const result = await transactionPromise;
    return { 
      success: true, 
      message: successMessage || '트랜잭션이 성공적으로 완료되었습니다',
      data: result 
    };
  } catch (error) {
    console.error('Transaction error:', error);
    return { 
      success: false, 
      message: getErrorMessage(error),
      error: error
    };
  }
}

/**
 * 구조화된 API 응답 생성기
 * 일관된 포맷으로 API 응답 생성
 * 
 * @param {boolean} success - 요청 성공 여부
 * @param {string} message - 응답 메시지
 * @param {Object} data - 응답 데이터 (성공 시)
 * @param {Object|Error} error - 오류 정보 (실패 시)
 * @returns {Object} 구조화된 응답 객체
 */
function createApiResponse(success, message, data = null, error = null) {
  return {
    success,
    message,
    data: success ? data : null,
    error: !success ? (typeof error === 'object' ? {
      code: error.code || 'UNKNOWN',
      message: getErrorMessage(error)
    } : { code: 'UNKNOWN', message: error }) : null
  };
}

module.exports = {
  getErrorMessage,
  handleTransaction,
  createApiResponse
};