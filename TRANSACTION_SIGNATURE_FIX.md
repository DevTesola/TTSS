# Transaction Signature Issue Fix

## 문제점

TESOLA NFT 스테이킹 시스템에서 트랜잭션 서명 관련 오류가 발생했습니다. 주요 문제는 다음과 같습니다:

1. 트랜잭션 직렬화 시 `requireAllSignatures` 옵션이 일관되지 않게 적용됨
2. 클라이언트-서버 간 트랜잭션 전달 과정에서 직렬화/역직렬화 비일관성
3. "Missing signature for public key" 오류 발생
4. 클라이언트에서 서명한 트랜잭션이 서버로 전송될 때 서명 검증 실패

## 해결책

이 문제를 해결하기 위해 다음과 같은 변경사항을 적용했습니다:

### 1. 트랜잭션 유틸리티 라이브러리 생성

공유 모듈로 트랜잭션 직렬화/역직렬화 함수를 모아 표준화했습니다:

- `/shared/utils/transaction-utils.js`: 서버 사이드 트랜잭션 유틸리티
- `/utils/transaction-utils-client.js`: 클라이언트 사이드 트랜잭션 유틸리티

### 2. 일관된 트랜잭션 직렬화 방식 구현

트랜잭션을 직렬화할 때 항상 다음과 같은 옵션을 사용하도록 표준화했습니다:

```javascript
function serializeTransactionForClientSigning(transaction) {
  return serializeTransaction(transaction, {
    requireAllSignatures: false,
    verifySignatures: false
  });
}
```

이로써 클라이언트에서 서명을 추가하기 전에 트랜잭션을 직렬화할 때 모든 서명이 필요하지 않도록 설정하여 오류를 방지합니다.

### 3. 트랜잭션 메타데이터 처리 표준화

트랜잭션에 feePayer, recentBlockhash 등의 메타데이터를 설정하는 함수를 표준화하여 일관된 방식으로 처리하도록 했습니다:

```javascript
function setTransactionMetadata(transaction, feePayer, blockhash, lastValidBlockHeight) {
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = blockhash;
  
  if (lastValidBlockHeight) {
    transaction.lastValidBlockHeight = lastValidBlockHeight;
  }
  
  return transaction;
}
```

### 4. 클라이언트 측 역직렬화 개선

클라이언트에서 서버로부터 받은 트랜잭션을 역직렬화할 때 표준화된 방식을 사용하여 오류를 방지하고 디버깅을 용이하게 했습니다:

```javascript
export function deserializeTransaction(base64Transaction) {
  try {
    return Transaction.from(Buffer.from(base64Transaction, 'base64'));
  } catch (error) {
    console.error('Transaction deserialization error:', error);
    throw new Error(`Failed to deserialize transaction: ${error.message}`);
  }
}
```

### 5. 디버깅 도구 추가

트랜잭션 서명 관련 문제를 쉽게 디버깅할 수 있는 유틸리티 함수 추가:

```javascript
export function getTransactionSignatureInfo(transaction) {
  return {
    signatureCount: transaction.signatures.length,
    signatures: transaction.signatures.map((signerPubkeyAndSignature, index) => ({
      index,
      publicKey: signerPubkeyAndSignature.publicKey.toString(),
      hasSigned: signerPubkeyAndSignature.signature !== null,
      isFeePayerIndex: index === 0 && transaction.feePayer && 
                      transaction.feePayer.equals(signerPubkeyAndSignature.publicKey)
    }))
  };
}
```

## 적용 파일

1. `/shared/utils/transaction-utils.js` (신규)
2. `/utils/transaction-utils-client.js` (신규)
3. `/shared/utils/transaction.js` (수정)
4. `/pages/api/prepareStaking_v3.js` (수정)
5. `/pages/api/prepareUnstaking_v3.js` (수정)
6. `/components/StakingComponent.jsx` (수정)

## 결과

이러한 변경 사항으로 인해:

1. 서버와 클라이언트 간 트랜잭션 전달 과정이 표준화됨
2. "Missing signature for public key" 오류 해결
3. 클라이언트 서명이 제대로 유지되어 트랜잭션 제출 성공률 향상
4. 코드 유지 관리성 및 재사용성 개선

## 향후 작업 계획

1. 다른 모든 트랜잭션 관련 API 엔드포인트에도 동일한 방식 적용
2. 클라이언트 컴포넌트에 일관된 트랜잭션 처리 로직 적용
3. 트랜잭션 실패 시 더 자세한 오류 메시지와 복구 전략 구현
4. 트랜잭션 서명 상태를 모니터링하고 분석하는 도구 개발