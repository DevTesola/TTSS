# TESOLA NFT 스테이킹 공통 모듈

이 디렉토리는 TESOLA NFT 스테이킹 시스템의 공통 모듈을 포함합니다. 이 모듈은 온체인 프로그램과 프론트엔드 간의 일관성을 보장하기 위해 설계되었습니다.

## 목적

- 온체인 프로그램과 프론트엔드 간의 상수 및 유틸리티 통합
- 코드 중복 감소
- 명확한 모듈화로 유지보수성 향상
- 일관된 오류 처리 메커니즘 제공

## 구조

```
/shared
├── /constants
│   ├── program-ids.js    # 프로그램 ID 및 주소
│   ├── seeds.js          # PDA 시드 값
│   ├── discriminators.js # 명령어 및 계정 식별자
│   ├── types.js          # 타입 정의
│   └── index.js          # 상수 통합 내보내기
├── /utils
│   ├── error-codes.js    # 오류 코드 정의
│   ├── error-handler.js  # 오류 처리 유틸리티
│   ├── transaction.js    # 트랜잭션 관련 유틸리티
│   ├── pda.js            # PDA 생성 유틸리티
│   └── index.js          # 유틸리티 통합 내보내기
├── /types                # 향후 확장용 타입 디렉토리
└── index.js              # 메인 진입점
```

## 사용 방법

```javascript
// 전체 모듈 가져오기
const shared = require('../shared');

// 특정 상수/유틸리티 가져오기
const { PROGRAM_ID, findPoolStatePDA, getErrorMessage } = require('../shared');

// 특정 하위 모듈에서 가져오기
const { createStakeNftInstruction } = require('../shared/utils/transaction');
```

## 주요 기능

### Constants

- **program-ids.js**: 프로그램 ID 및 관련 주소 정의
- **seeds.js**: PDA 생성에 사용되는 시드 버퍼 정의
- **discriminators.js**: 명령어 및 계정 식별자 정의
- **types.js**: 상수 값(NFT 등급, 스테이킹 기간 등) 정의

### Utils

- **error-handler.js**: 일관된 오류 처리 메커니즘 제공
- **transaction.js**: 트랜잭션 생성 및 직렬화 유틸리티
- **pda.js**: PDA 주소 생성 유틸리티

## 참고 사항

- 모든 상수 값은 온체인 프로그램 정의와 동기화되어 있습니다
- IDL 파일에서 추출된 식별자를 사용하여 일관성 유지
- API 응답 형식 통일화로 프론트엔드 처리 간소화

## 업데이트 방법

온체인 프로그램이 업데이트될 경우:

1. 새 IDL을 추출하여 `/idl` 디렉토리에 저장
2. `shared/constants/discriminators.js` 파일을 IDL의 새 식별자로 업데이트
3. 새 명령어나 계정 타입이 추가된 경우 관련 타입 정의와 유틸리티 함수 업데이트
4. 변경사항이 있는 API 엔드포인트 확인 및 업데이트

## 작성자

TESOLA 개발팀, 2025년 5월