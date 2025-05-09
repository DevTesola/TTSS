# 스테이킹 시스템 문제 해결 요약

## 문제 진단

1. **관리자 지갑 불일치**
   - 환경 변수에 설정된 관리자 지갑: `qNfZ9QHYyu5dDDMvVAZ1hE55JX4GfUYQyfvLzZKBZi3`
   - 실제 풀 상태 계정의 관리자: `9oxL4PQDWPhZwKm8r6HiJpm55CpqpkYciuN3JTwbDkEf`

2. **풀 상태 PDA 불일치**
   - 우리가 생성한 PDA: `DqWnzEPrCVVZ4ofi83wmcJoiFqKrRc8VTaqXsz14z2Tp`
   - 온체인 프로그램이 기대하는 PDA: `8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP`

3. **풀 초기화 시도 실패**
   - 온체인 프로그램이 특정 시드로 생성된 PDA를 기대하지만, 이 시드를 정확히 알 수 없어 초기화 실패
   - 에러 메시지: `ConstraintSeeds. Error Number: 2006. A seeds constraint was violated.`

## 해결 방안

1. **환경 변수 조정**
   - `.env.local` 파일에서 `NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES` 값을 실제 풀 상태 계정의 관리자 주소로 변경
   - `.env.local` 파일에서 `POOL_STATE_ADDRESS` 값을 온체인 풀 상태 계정 주소로 설정

2. **스테이킹/언스테이킹 API 수정**
   - `prepareStaking_v3.js`와 `prepareUnstaking_v3.js`가 환경 변수에서 풀 상태 주소를 읽도록 수정
   - 하드코딩된 주소 대신 환경 변수 사용

3. **관리자 풀 초기화 포기**
   - 새 풀 초기화 시도 포기 (Anchor 프로그램의 PDA 시드 제약으로 인해 실패)
   - 대신 이미 초기화된 `8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP` 풀 사용

## 학습 및 향후 계획

1. **풀 상태 정보**
   - 풀 상태: 활성 (paused: false)
   - 보상 비율: 100
   - 긴급 인출 수수료: 5%

2. **관리자 지갑**
   - `9oxL4PQDWPhZwKm8r6HiJpm55CpqpkYciuN3JTwbDkEf` 지갑을 관리자로 사용
   - 이 지갑을 통해 풀 설정 업데이트와 관리자 기능 수행 가능

3. **향후 작업**
   - 시드 구조 분석을 통해 PDA 생성 방식 이해 (필요시)
   - 보다 유연한 관리자 인증 시스템 구현
   - 관리자 지갑 변경 기능 검토

## 요약

이 문제는 환경 변수와 온체인 실제 상태 간의 불일치로 인해 발생했습니다. 새로운 풀을 초기화하는 대신 이미 온체인에 존재하는 풀을 사용하고, 환경 변수를 해당 풀의 실제 관리자 주소로 업데이트하여 해결했습니다.

이제 스테이킹과 언스테이킹 기능이 정상적으로 작동할 것이며, 관리자 기능은 올바른 관리자 지갑(`9oxL4PQDWPhZwKm8r6HiJpm55CpqpkYciuN3JTwbDkEf`)을 사용하여 수행해야 합니다.