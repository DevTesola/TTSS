/**
 * 트랜잭션 유틸리티 함수 테스트
 */

const { 
  serializeTransaction, 
  deserializeTransaction, 
  setTransactionMetadata,
  serializeTransactionForClientSigning
} = require('../shared/utils/transaction-utils');

const { Transaction, PublicKey, SystemProgram } = require('@solana/web3.js');

describe('Transaction Utilities', () => {
  // 테스트용 변수
  const fromWallet = new PublicKey('5ZLH7FGCXLPZveEf3AoQKJpnYF2LzUcJccW3y15DiprA');
  const toWallet = new PublicKey('qNfZ9QHYyu5dDDMvVAZ1hE55JX4GfUYQyfvLzZKBZi3');
  const blockhash = 'EGJScpJKZToCQxwn3TXfoVBnLRzjKhvXRQtdNxWuFiG7';
  const lastValidBlockHeight = 123456789;
  
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
    
    return tx;
  }
  
  /**
   * 트랜잭션 메타데이터 설정 테스트
   */
  test('setTransactionMetadata sets correct metadata', () => {
    const tx = createTestTransaction();
    
    // 메타데이터 설정
    setTransactionMetadata(tx, fromWallet, blockhash, lastValidBlockHeight);
    
    // 결과 확인
    expect(tx.feePayer.toString()).toBe(fromWallet.toString());
    expect(tx.recentBlockhash).toBe(blockhash);
    expect(tx.lastValidBlockHeight).toBe(lastValidBlockHeight);
  });
  
  /**
   * 트랜잭션 직렬화/역직렬화 테스트
   */
  test('serialization and deserialization work correctly', () => {
    const tx = createTestTransaction();
    setTransactionMetadata(tx, fromWallet, blockhash, lastValidBlockHeight);
    
    // 직렬화
    const serialized = serializeTransactionForClientSigning(tx);
    
    // 직렬화된 결과가 base64 문자열인지 확인
    expect(typeof serialized).toBe('string');
    expect(serialized).toMatch(/^[A-Za-z0-9+/]*={0,2}$/); // base64 패턴
    
    // 역직렬화
    const deserialized = deserializeTransaction(serialized);
    
    // 원본 트랜잭션과 동일한지 확인
    expect(deserialized.recentBlockhash).toBe(tx.recentBlockhash);
    expect(deserialized.feePayer.toString()).toBe(tx.feePayer.toString());
    expect(deserialized.instructions.length).toBe(tx.instructions.length);
    
    // 명령어 세부 정보 확인
    const originalInstruction = tx.instructions[0];
    const deserializedInstruction = deserialized.instructions[0];
    
    expect(deserializedInstruction.programId.toString()).toBe(originalInstruction.programId.toString());
    expect(deserializedInstruction.keys.length).toBe(originalInstruction.keys.length);
  });
  
  /**
   * 오류 케이스 테스트: 잘못된 입력값
   */
  test('deserializeTransaction throws on invalid input', () => {
    // 비어있는 입력
    expect(() => deserializeTransaction('')).toThrow();
    expect(() => deserializeTransaction(null)).toThrow();
    expect(() => deserializeTransaction(undefined)).toThrow();
    
    // 잘못된 타입
    expect(() => deserializeTransaction(123)).toThrow();
    expect(() => deserializeTransaction({})).toThrow();
    
    // 유효하지 않은 base64
    expect(() => deserializeTransaction('not-a-base64-string!')).toThrow();
    
    // 유효한 base64이지만 유효하지 않은 트랜잭션
    expect(() => deserializeTransaction('aGVsbG8gd29ybGQ=')).toThrow(); // "hello world" in base64
  });
  
  /**
   * 오류 케이스 테스트: 직렬화 옵션
   */
  test('serializeTransaction handles options correctly', () => {
    const tx = createTestTransaction();
    setTransactionMetadata(tx, fromWallet, blockhash, lastValidBlockHeight);
    
    // 기본 옵션으로 직렬화
    const defaultSerialized = serializeTransaction(tx);
    expect(typeof defaultSerialized).toBe('string');
    
    // requireAllSignatures: true로 설정 시 서명 없는 트랜잭션은 오류 발생해야 함
    expect(() => serializeTransaction(tx, { requireAllSignatures: true })).toThrow();
    
    // 모든 서명이 없는 경우 requireAllSignatures: false로 직렬화 가능
    const noSignSerialized = serializeTransaction(tx, { requireAllSignatures: false });
    expect(typeof noSignSerialized).toBe('string');
  });
  
  /**
   * 트랜잭션 크기 제한 테스트
   */
  test('rejects transactions exceeding size limit', () => {
    const tx = createTestTransaction();
    setTransactionMetadata(tx, fromWallet, blockhash, lastValidBlockHeight);
    
    // 많은 명령어를 추가하여 크기 증가
    for (let i = 0; i < 100; i++) {
      tx.add(SystemProgram.transfer({
        fromPubkey: fromWallet,
        toPubkey: toWallet,
        lamports: 1000 + i
      }));
    }
    
    // 직렬화 시 오류가 발생하거나, 오류가 발생하지 않더라도 크기가 1232 바이트 이하여야 함
    try {
      const serialized = serializeTransactionForClientSigning(tx);
      const buffer = Buffer.from(serialized, 'base64');
      
      // 성공적으로 직렬화된 경우, 크기가 1232 바이트 이하여야 함
      expect(buffer.length).toBeLessThanOrEqual(1232);
    } catch (error) {
      // 오류 발생 시 크기 초과 오류여야 함
      expect(error.message).toContain('크기');
    }
  });
});