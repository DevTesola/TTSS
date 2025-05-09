# Pool State 및 관리자 지갑 통일 수정 사항

## 문제점

- pool_state 계정의 관리자 주소와 환경 변수에 설정된 관리자 주소가 일치하지 않음
- 새로운 풀을 초기화하는 데 제한이 있어 풀을 재설정하기 어려움
- 하드코딩된 풀 주소와 환경 변수의 불일치

## 수정 사항

1. **prepareStaking_v3.js**: 풀 주소를 환경 변수에서 읽도록 수정
2. **prepareUnstaking_v3.js**: 풀 주소를 환경 변수에서 읽도록 수정
3. **initialize-pool.js (관리자 페이지)**: 
   - 강제 초기화 옵션 추가
   - 버튼 항상 활성화 (기존 풀이 있어도 강제 초기화 가능)
   - 환경 변수 설정 가이드 개선
   - 관리자 일치 여부 표시 추가
4. **initialize-pool.js (API)**: forceInitialize 매개변수 처리 추가
5. **check-pool.js (API)**: 관리자 일치 여부 검사 기능 추가

## 사용 방법

1. 관리자 페이지(/admin/initialize-pool)에서 'qNfZ9QHYyu5dDDMvVAZ1hE55JX4GfUYQyfvLzZKBZi3' 지갑으로 연결
2. 풀 초기화 버튼 클릭 (새 풀 강제 초기화)
3. 트랜잭션 서명 후 성공하면 표시되는 새 풀 주소를 확인
4. 서버 환경 변수 (.env.local)에 POOL_STATE_ADDRESS=<새_풀_주소> 추가
5. 서버 재시작

이 수정 사항으로 관리자 지갑을 'qNfZ9QHYyu5dDDMvVAZ1hE55JX4GfUYQyfvLzZKBZi3'로 통일하고, 모든 컴포넌트가 동일한 풀 주소를 사용하게 됩니다.
