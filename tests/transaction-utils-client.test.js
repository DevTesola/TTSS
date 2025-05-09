/**
 * 클라이언트측 트랜잭션 유틸리티 함수 테스트
 */

import { 
  deserializeTransaction, 
  serializeTransaction,
  getTransactionSignatureInfo,
  isFullySigned
} from '../utils/transaction-utils-client';

import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js';

describe('Client Transaction Utilities', () => {
  // 테스트용 변수
  const fromWallet = new PublicKey('5ZLH7FGCXLPZveEf3AoQKJpnYF2LzUcJccW3y15DiprA');
  const toWallet = new PublicKey('qNfZ9QHYyu5dDDMvVAZ1hE55JX4GfUYQyfvLzZKBZi3');
  const blockhash = 'EGJScpJKZToCQxwn3TXfoVBnLRzjKhvXRQtdNxWuFiG7';
  
  /**
   * 테스트용 트랜잭션 생성
   */
  function createTestTransaction() {
    const tx = new Transaction();
    
    // 간단한 SOL 전송 명령 추가
    tx.add(SystemProgram.transfer({
      fromPubkey: fromWallet,
      toPubkey: toWallet,
      lamports: 1000000 // 0.001 SOL
    }));
    
    // 메타데이터 설정
    tx.feePayer = fromWallet;
    tx.recentBlockhash = blockhash;
    
    return tx;
  }
  
  /**
   * 트랜잭션 직렬화/역직렬화 테스트
   */
  test('serialization and deserialization work correctly', () => {
    const tx = createTestTransaction();
    
    // 클라이언트 측 직렬화 (기본적으로 모든 서명 필요)
    const serialized = serializeTransaction(tx, { requireAllSignatures: false });
    
    // 직렬화된 결과가 Buffer 타입인지 확인
    expect(Buffer.isBuffer(serialized)).toBe(true);
    
    // base64로 변환
    const serializedBase64 = serialized.toString('base64');
    
    // 역직렬화
    const deserialized = deserializeTransaction(serializedBase64);
    
    // 원본 트랜잭션과 동일한지 확인
    expect(deserialized.recentBlockhash).toBe(tx.recentBlockhash);
    expect(deserialized.feePayer.toString()).toBe(tx.feePayer.toString());
    expect(deserialized.instructions.length).toBe(tx.instructions.length);
  });
  
  /**
   * 서명 정보 테스트
   */
  test('getTransactionSignatureInfo returns correct info', () => {
    const tx = createTestTransaction();
    
    // 서명 정보 가져오기
    const signatureInfo = getTransactionSignatureInfo(tx);
    
    // 기본 정보 확인
    expect(signatureInfo.signatureCount).toBe(1); // 한 개의 서명 슬롯
    expect(signatureInfo.signatures[0].publicKey).toBe(fromWallet.toString());
    expect(signatureInfo.signatures[0].hasSigned).toBe(false); // 아직 서명 안됨
    expect(signatureInfo.signatures[0].isFeePayerIndex).toBe(true); // feePayer가 첫 번째 서명 위치
  });
  
  /**
   * 서명 상태 확인 테스트
   */
  test('isFullySigned correctly identifies signature status', () => {
    const tx = createTestTransaction();
    
    // 서명 안 된 상태
    expect(isFullySigned(tx)).toBe(false);
    
    // 서명 시뮬레이션 (실제로는 지갑에서 서명해야 함)
    // 이 테스트에서는 서명 없이 더미 값을 설정하기만 함
    tx.signatures[0].signature = Buffer.alloc(64).fill(1);
    
    // 서명된 상태
    expect(isFullySigned(tx)).toBe(true);
  });
  
  /**
   * 오류 케이스 테스트
   */
  test('deserializeTransaction handles errors gracefully', () => {
    // 비어있는 입력
    expect(() => deserializeTransaction('')).toThrow();
    expect(() => deserializeTransaction(null)).toThrow();
    
    // 잘못된 타입
    expect(() => deserializeTransaction(123)).toThrow();
    
    // 유효하지 않은 base64
    expect(() => deserializeTransaction('not-valid-base64!')).toThrow();
    
    // 유효한 base64지만 트랜잭션 데이터가 아님
    expect(() => deserializeTransaction('SGVsbG8gV29ybGQ=')).toThrow(); // "Hello World"
  });
});