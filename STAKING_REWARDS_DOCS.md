# 스테이킹 리워드 청구 시스템 문서

본 문서는 Tesola 스테이킹 시스템의 리워드 청구 기능 구현에 대한 기술 문서입니다.

## 개요

Tesola NFT 스테이킹 시스템에서는 사용자가 NFT를 스테이킹하고 일정 기간이 지나면 리워드를 받을 수 있습니다. 이 리워드 청구 시스템은 다음 핵심 기능을 제공합니다:

1. **온체인 리워드 청구** - 스테이킹된 NFT에 대한 발생된 리워드를 Solana 블록체인에서 직접 청구
2. **트랜잭션 준비 및 서명** - 청구 트랜잭션을 준비하고 클라이언트 지갑에서 서명
3. **리워드 계산** - NFT 등급과 스테이킹 기간에 따른 리워드 계산
4. **상태 추적** - 청구 내역 및 시간 기록

## 시스템 아키텍처

스테이킹 리워드 청구 시스템은 다음 컴포넌트로 구성됩니다:

1. **프론트엔드 컴포넌트** 
   - `StakingRewards.jsx` - 사용자 인터페이스 제공
   - `WalletContext` - 지갑 연결 및 서명 관리

2. **백엔드 API**
   - `prepareClaimRewards.js` - 트랜잭션 준비
   - `completeClaimRewards.js` - 청구 완료 처리

3. **공통 유틸리티**
   - `instruction-utils.js` - 트랜잭션 명령어 생성 및 직렬화
   - `constants.js` - 청구 관련 상수 정의
   - `error-handler.js` - 오류 처리 및 사용자 친화적 메시지 변환

4. **데이터 저장소**
   - Supabase - 청구 내역 및 스테이킹 상태 저장
   - Solana 블록체인 - 실제 리워드 및 스테이킹 상태 저장

## API 엔드포인트

### 1. 리워드 청구 준비 API

**엔드포인트**: `/api/prepareClaimRewards`

**요청 형식**:
```json
{
  "wallet": "사용자_지갑_주소",
  "mintAddress": "NFT_민트_주소"
}
```

**응답 형식**:
```json
{
  "success": true,
  "transactionBase64": "직렬화된_트랜잭션_문자열",
  "stakingInfo": {
    "id": "스테이킹_레코드_ID",
    "wallet_address": "사용자_지갑_주소",
    "mint_address": "NFT_민트_주소",
    "staked_at": "스테이킹_시작_시간",
    "status": "staked",
    "nft_tier": "NFT_등급",
    "staking_period": 스테이킹_기간
  },
  "claimDetails": {
    "nftMint": "NFT_민트_주소",
    "stakingPeriod": 스테이킹_기간,
    "stakingStartDate": "스테이킹_시작_일자",
    "lastClaimDate": "마지막_청구_일자",
    "transactionExpiry": 트랜잭션_만료_블록_높이
  }
}
```

### 2. 리워드 청구 완료 API

**엔드포인트**: `/api/staking/completeClaimRewards`

**요청 형식**:
```json
{
  "wallet": "사용자_지갑_주소",
  "signature": "트랜잭션_서명",
  "mintAddress": "NFT_민트_주소",
  "claimId": "청구_ID"
}
```

**응답 형식**:
```json
{
  "success": true,
  "message": "Rewards claimed successfully",
  "transaction": {
    "signature": "트랜잭션_서명",
    "blockTime": 블록_타임스탬프
  }
}
```

## 온체인 프로그램 통합

이 시스템은 Solana 네트워크에 배포된 NFT 스테이킹 프로그램과 통합됩니다. 주요 구성 요소는 다음과 같습니다:

### 1. 프로그램 ID
```
4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs
```

### 2. 계정 구조
리워드 청구 트랜잭션에는 다음 계정이 포함됩니다:

```javascript
[
  { pubkey: walletPubkey, isSigner: true, isWritable: true },          // user (signer, writable)
  { pubkey: mintPubkey, isSigner: false, isWritable: false },          // nft_mint
  { pubkey: stakeInfoPDA, isSigner: false, isWritable: true },         // stake_info (writable, PDA)
  { pubkey: poolStatePDA, isSigner: false, isWritable: true },         // pool_state (writable, PDA)
  { pubkey: userStakingInfoPDA, isSigner: false, isWritable: false },  // user_staking_info (PDA)
  { pubkey: rewardVaultAddress, isSigner: false, isWritable: true },   // reward_vault (writable)
  { pubkey: rewardVaultAuthorityPDA, isSigner: false, isWritable: false }, // reward_vault_authority (PDA)
  { pubkey: userRewardTokenAccount, isSigner: false, isWritable: true }, // user_token_account (writable)
  { pubkey: rewardMintPubkey, isSigner: false, isWritable: false },    // reward_mint
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // token_program
  { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
  { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false }          // rent
]
```

### 3. 명령어 데이터
`claim_rewards` 명령어 데이터 형식:

```javascript
// CLAIM_REWARDS discriminator (8 bytes)
[4, 144, 132, 71, 116, 23, 151, 80]
```

이 명령어에는 추가 매개변수가 없습니다.

## 시나리오: 리워드 청구 과정

전체 리워드 청구 과정은 다음과 같은 단계로 진행됩니다:

1. **사용자 요청**
   - 사용자가 스테이킹 대시보드에서 "Claim Rewards" 버튼 클릭

2. **트랜잭션 준비**
   - 프론트엔드가 `prepareClaimRewards` API 호출
   - 백엔드는 NFT가 스테이킹 상태인지 확인
   - PDA 계정 찾기: stake_info, pool_state, user_staking_info, reward_vault_authority
   - 사용자 토큰 계정 확인/생성
   - 트랜잭션 생성 및 시뮬레이션

3. **트랜잭션 서명**
   - 프론트엔드가 트랜잭션을 사용자의 지갑으로 전송
   - 사용자가 트랜잭션 서명
   - 서명된 트랜잭션을 Solana 네트워크에 제출

4. **청구 완료**
   - 프론트엔드가 트랜잭션 서명을 `completeClaimRewards` API로 전송
   - 백엔드가 트랜잭션 성공 여부 확인
   - 청구 기록 및 스테이킹 정보 업데이트

5. **사용자 알림**
   - 프론트엔드가 사용자에게 성공 또는 실패 메시지 표시

## 오류 처리

시스템은 다음과 같은 오류 상황을 처리합니다:

1. **유효성 검사 오류**
   - 지갑 주소 누락/유효하지 않음
   - NFT 민트 주소 누락/유효하지 않음
   - 스테이킹 상태가 아닌 NFT

2. **리워드 관련 오류**
   - 리워드 잔액 부족
   - 너무 빠른 청구 시도 (쿨다운 기간)

3. **트랜잭션 오류**
   - 서명 오류
   - 트랜잭션 실패
   - 타임아웃

각 오류는 적절한 오류 코드와 사용자 친화적인 메시지로 처리됩니다.

## 테스트

시스템 테스트를 위해 다음 스크립트를 실행할 수 있습니다:

```bash
cd /home/tesola/ttss/tesolafixjs && ./tests/run-tests.sh
```

이 스크립트는 다음 테스트를 수행합니다:

1. 청구 준비 API 테스트
2. 청구 완료 API 테스트
3. 오류 상황 테스트

## 결론

스테이킹 리워드 청구 시스템은 Solana 블록체인과 완전히 통합된 온체인 리워드 처리를 제공합니다. 이를 통해 사용자는 스테이킹한 NFT에 대한 리워드를 안전하고 투명하게 청구할 수 있습니다. 시스템은 다양한 오류 상황을 처리하고 트랜잭션 결과를 데이터베이스에 기록하여 일관된 사용자 경험을 보장합니다.