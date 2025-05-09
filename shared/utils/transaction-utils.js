/**
 * 트랜잭션 직렬화 및 역직렬화를 위한 유틸리티 함수
 */

const { Transaction } = require('@solana/web3.js');

/**
 * 트랜잭션을 Base64 문자열로 직렬화 (향상된 오류 처리 포함)
 *
 * @param {Transaction} transaction - 직렬화할 트랜잭션
 * @param {Object} options - 직렬화 옵션
 * @param {boolean} options.requireAllSignatures - 모든 서명이 필요한지 여부 (기본값: false)
 * @param {boolean} options.verifySignatures - 서명 검증 여부 (기본값: false)
 * @returns {string} Base64로 인코딩된 직렬화된 트랜잭션
 * @throws {Error} 직렬화 중 오류 발생 시
 */
function serializeTransaction(transaction, options = {}) {
  // 입력 유효성 검사
  if (!transaction) {
    throw new Error('직렬화 실패: 트랜잭션 객체가 없습니다');
  }

  if (typeof transaction !== 'object' || !transaction.serialize) {
    throw new Error(`직렬화 실패: 유효한 트랜잭션 객체가 아닙니다`);
  }

  // 트랜잭션 유효성 검사 - 잠재적인 문제 체크
  if (!transaction.instructions || transaction.instructions.length === 0) {
    console.warn('경고: 직렬화할 트랜잭션에 명령어가 없습니다');
  }

  if (!transaction.recentBlockhash) {
    console.warn('경고: 트랜잭션에 recentBlockhash가 설정되지 않았습니다');
  }

  if (!transaction.feePayer) {
    console.warn('경고: 트랜잭션에 feePayer가 설정되지 않았습니다');
  }

  // 서명 상태 체크 (디버그용)
  const hasAllSignatures = transaction.signatures.every(sig => !!sig.signature);
  if (options.requireAllSignatures && !hasAllSignatures) {
    console.warn('경고: requireAllSignatures가 true로 설정되었지만 모든 서명이 존재하지 않습니다');
  }

  // 직렬화 옵션 설정
  const serializationOptions = {
    requireAllSignatures: options.requireAllSignatures || false,
    verifySignatures: options.verifySignatures || false
  };

  try {
    // 트랜잭션 직렬화
    const serialized = transaction.serialize(serializationOptions);

    // 직렬화된 트랜잭션 크기 체크
    if (serialized.length > 1232) {
      throw new Error(`직렬화된 트랜잭션 크기가 Solana 한도를 초과합니다 (${serialized.length}/1232 바이트)`);
    }

    // Base64로 인코딩하여 반환
    return Buffer.from(serialized).toString('base64');
  } catch (error) {
    // 상세한 오류 메시지 생성
    console.error('트랜잭션 직렬화 오류:', error);

    // 더 구체적인 오류 메시지 생성
    let errorMessage = '트랜잭션 직렬화 실패';

    if (error.message.includes('failed to serialize')) {
      errorMessage = '트랜잭션 직렬화에 실패했습니다: 형식이 잘못되었습니다';
    } else if (error.message.includes('not signed')) {
      errorMessage = '서명되지 않은 트랜잭션을 직렬화할 수 없습니다 (requireAllSignatures가 true로 설정됨)';
    } else if (error.message.includes('signature verification failed')) {
      errorMessage = '서명 검증에 실패했습니다 (verifySignatures가 true로 설정됨)';
    } else {
      errorMessage = `${errorMessage}: ${error.message}`;
    }

    // 오류 전파
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.code = 'TRANSACTION_SERIALIZE_ERROR';
    enhancedError.options = serializationOptions;
    throw enhancedError;
  }
}

/**
 * Base64 문자열에서 트랜잭션 역직렬화
 *
 * @param {string} base64Transaction - Base64로 인코딩된 트랜잭션
 * @returns {Transaction} 복원된 트랜잭션 객체
 * @throws {Error} 입력 검증 오류 또는 역직렬화 실패 시
 */
function deserializeTransaction(base64Transaction) {
  // 입력 유효성 검사
  if (!base64Transaction) {
    throw new Error('역직렬화 실패: 트랜잭션 데이터가 없습니다');
  }

  if (typeof base64Transaction !== 'string') {
    throw new Error(`역직렬화 실패: 트랜잭션은 문자열이어야 합니다. 현재 타입: ${typeof base64Transaction}`);
  }

  // 유효한 base64 형식 확인 (정규식 패턴)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Transaction)) {
    throw new Error('역직렬화 실패: 유효하지 않은 Base64 형식입니다');
  }

  try {
    // Base64 디코딩
    const buffer = Buffer.from(base64Transaction, 'base64');

    // 최소 크기 확인 (트랜잭션 헤더에 필요한 최소 크기)
    if (buffer.length < 10) {
      throw new Error(`역직렬화 실패: 트랜잭션 데이터가 너무 짧습니다 (${buffer.length} 바이트)`);
    }

    // 트랜잭션 크기 제한 확인 (Solana 트랜잭션 최대 크기: 1232 바이트)
    if (buffer.length > 1232) {
      throw new Error(`역직렬화 실패: 트랜잭션 크기가 Solana 한도를 초과합니다 (${buffer.length}/1232 바이트)`);
    }

    // 트랜잭션 역직렬화
    return Transaction.from(buffer);
  } catch (error) {
    // 상세한 오류 메시지 생성
    console.error('트랜잭션 역직렬화 오류:', error);

    // 더 구체적인 오류 메시지 생성
    let errorMessage = '트랜잭션 역직렬화 실패';

    if (error.message.includes('index out of bounds')) {
      errorMessage = '트랜잭션 데이터 형식이 잘못되었습니다 (인덱스 범위 초과)';
    } else if (error.message.includes('Invalid buffer')) {
      errorMessage = '유효하지 않은 트랜잭션 데이터 버퍼입니다';
    } else if (error.message.includes('Unsupported header')) {
      errorMessage = '지원되지 않는 트랜잭션 헤더입니다';
    } else if (error.message.includes('not a base64 string')) {
      errorMessage = '유효한 Base64 인코딩 문자열이 아닙니다';
    } else {
      errorMessage = `${errorMessage}: ${error.message}`;
    }

    // 오류 전파
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.code = 'TRANSACTION_DESERIALIZE_ERROR';
    throw enhancedError;
  }
}

/**
 * 트랜잭션에 공통 메타데이터 설정
 * 
 * @param {Transaction} transaction - 설정할 트랜잭션
 * @param {PublicKey} feePayer - 수수료 지불자
 * @param {string} blockhash - 최근 블록해시
 * @param {number} lastValidBlockHeight - 마지막 유효 블록 높이
 * @returns {Transaction} 설정된 트랜잭션
 */
function setTransactionMetadata(transaction, feePayer, blockhash, lastValidBlockHeight) {
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = blockhash;
  
  if (lastValidBlockHeight) {
    transaction.lastValidBlockHeight = lastValidBlockHeight;
  }
  
  return transaction;
}

/**
 * 서명 확인 없이 트랜잭션 직렬화 (클라이언트 서명용)
 * 
 * @param {Transaction} transaction - 직렬화할 트랜잭션
 * @returns {string} Base64로 인코딩된 직렬화된 트랜잭션
 */
function serializeTransactionForClientSigning(transaction) {
  return serializeTransaction(transaction, {
    requireAllSignatures: false,
    verifySignatures: false
  });
}

/**
 * 모든 서명이 필요한 트랜잭션 직렬화 (검증용)
 * 
 * @param {Transaction} transaction - 직렬화할 트랜잭션
 * @returns {string} Base64로 인코딩된 직렬화된 트랜잭션
 */
function serializeTransactionWithSignatures(transaction) {
  return serializeTransaction(transaction, {
    requireAllSignatures: true,
    verifySignatures: true
  });
}

module.exports = {
  serializeTransaction,
  deserializeTransaction,
  setTransactionMetadata,
  serializeTransactionForClientSigning,
  serializeTransactionWithSignatures
};