/**
 * NFT 스테이킹 프로그램 에러 코드 정의
 * 프로그램 에러 코드와 해당 메시지의 매핑
 */

// 프로그램 에러 코드 매핑 (코드 -> {코드 이름, 메시지})
const ERROR_CODES = {
  6000: { code: 'NotStaked', message: 'NFT가 스테이킹되지 않았습니다' },
  6001: { code: 'NotOwner', message: 'NFT의 소유자가 아닙니다' },
  6002: { code: 'NotAdmin', message: '관리자 권한이 없습니다' },
  6003: { code: 'PoolPaused', message: '스테이킹 풀이 일시 중지되었습니다' },
  6004: { code: 'StakingPeriodNotCompleted', message: '스테이킹 기간이 아직 완료되지 않았습니다' },
  6005: { code: 'InvalidNftTier', message: '유효하지 않은 NFT 등급입니다' },
  6006: { code: 'InvalidStakingPeriod', message: '유효하지 않은 스테이킹 기간입니다' },
  6007: { code: 'MaxNftsExceeded', message: '사용자당 최대 NFT 수를 초과했습니다' },
  6008: { code: 'InvalidMint', message: '유효하지 않은 토큰 민트입니다' },
  6009: { code: 'InvalidVault', message: '유효하지 않은 보상 볼트입니다' },
  6010: { code: 'InsufficientRewardBalance', message: '보상 잔액이 부족합니다' },
  6011: { code: 'ClaimTooSoon', message: '이전 청구 후 너무 빨리 청구를 요청했습니다' },
  6012: { code: 'ArithmeticError', message: '계산 오류가 발생했습니다' },
  
  // 거버넌스 관련 에러
  6013: { code: 'InvalidVotingParams', message: '유효하지 않은 투표 매개변수입니다' },
  6014: { code: 'InsufficientVotingPower', message: '투표력이 부족합니다' },
  6015: { code: 'VotingPeriodNotActive', message: '투표 기간이 활성화되지 않았습니다' },
  6016: { code: 'AlreadyVoted', message: '이미 이 제안에 투표했습니다' },
  6017: { code: 'CannotExecuteProposal', message: '제안을 실행할 수 없습니다' },
  6018: { code: 'ProposalAlreadyExecuted', message: '제안이 이미 실행되었습니다' },
  6019: { code: 'ProposalAlreadyCancelled', message: '제안이 이미 취소되었습니다' },
  6020: { code: 'InvalidProposalStatus', message: '유효하지 않은 제안 상태입니다' },
  
  // 소셜 검증 관련 에러
  6021: { code: 'SocialVerificationNotAvailable', message: '소셜 검증을 사용할 수 없습니다' },
  6022: { code: 'InvalidVerificationProof', message: '유효하지 않은 검증 증명입니다' },
  6023: { code: 'CooldownNotElapsed', message: '쿨다운 기간이 경과하지 않았습니다' },
  6024: { code: 'DailyLimitReached', message: '일일 한도에 도달했습니다' },
  6025: { code: 'NotAuthorized', message: '이 작업에 대한 권한이 없습니다' }
};

// 솔라나 지갑 및 네트워크 관련 에러 코드
const SOLANA_ERROR_CODES = {
  4001: { code: 'UserRejected', message: '사용자가 트랜잭션을 취소했습니다' },
  4100: { code: 'Unauthorized', message: '권한이 없는 요청입니다' },
  4900: { code: 'DisconnectedFromChain', message: '체인 연결이 끊겼습니다' },
  4901: { code: 'ChainDisconnected', message: '체인이 연결되지 않았습니다' },
  32000: { code: 'UserRejectedRequest', message: '사용자가 요청을 거부했습니다' },
  32002: { code: 'MethodNotFound', message: '지원되지 않는 메서드입니다' },
  32601: { code: 'MethodNotFound', message: '지원되지 않는 메서드입니다' },
  32603: { code: 'InternalError', message: '내부 오류가 발생했습니다' }
};

// 일반적인 클라이언트 에러 코드
const CLIENT_ERROR_CODES = {
  'WalletNotConnected': { code: 'WalletNotConnected', message: '지갑이 연결되지 않았습니다. 지갑을 연결하세요' },
  'InsufficientFunds': { code: 'InsufficientFunds', message: 'SOL 잔액이 부족합니다. 지갑에 SOL을 충전하세요' },
  'NetworkError': { code: 'NetworkError', message: 'Solana 네트워크 연결 실패. 네트워크 연결을 확인하세요' },
  'BlockhashExpired': { code: 'BlockhashExpired', message: '트랜잭션 타임아웃. 다시 시도하세요' },
  'SimulationError': { code: 'SimulationError', message: '트랜잭션 시뮬레이션 실패. 다시 시도하세요' }
};

module.exports = {
  ERROR_CODES,
  SOLANA_ERROR_CODES,
  CLIENT_ERROR_CODES
};