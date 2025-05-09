/**
 * 네트워크 관련 상수 정의
 * Solana RPC 엔드포인트 및 네트워크 관련 설정 포함
 */

// Solana RPC 엔드포인트
export const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

// 네트워크 상수
export const NETWORK = {
  // Commitment 레벨
  COMMITMENT: 'confirmed',
  
  // 트랜잭션 처리 타임아웃 (밀리초)
  TRANSACTION_TIMEOUT: 60000, // 60초
  
  // 블록 확인 수 (finality)
  CONFIRMATION_BLOCKS: 1,
  
  // 재시도 설정
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1초
  
  // 지원되는 최대 트랜잭션 버전
  MAX_SUPPORTED_TRANSACTION_VERSION: 0
};

// Preflight 커밋 및 설정
export const PREFLIGHT_COMMITMENT = 'processed';

// 연결 설정
export const CONNECTION_CONFIG = {
  commitment: NETWORK.COMMITMENT,
  confirmTransactionInitialTimeout: NETWORK.TRANSACTION_TIMEOUT,
  disableRetryOnRateLimit: false
};

export default {
  SOLANA_RPC_ENDPOINT,
  NETWORK,
  PREFLIGHT_COMMITMENT,
  CONNECTION_CONFIG
};