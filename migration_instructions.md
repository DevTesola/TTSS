# TESOLA NFT 스테이킹 시스템 마이그레이션 지침

이 문서는 Dynamic Reward Booster 기능과 사용자당 최대 스테이킹 NFT 수량 증가를 위한 마이그레이션 과정을 설명합니다.

## 1. 프로그램 업데이트 절차

### 코드 업데이트

1. `programs/nft_staking_fixed/src/lib.rs` 파일을 수정합니다.
   - 제공된 패치 파일 `nft_staking_update.patch`를 적용하거나
   - 직접 필요한 변경사항을 수동으로 적용

2. 새로운 명령어 추가:
   - `update_time_multiplier` - 시간 기반 승수 업데이트를 위한 명령어
   - `migrateStakeInfo` - 기존 StakeInfo 계정을 새 형식으로 마이그레이션
   - `migrateUserStakingInfo` - 기존 UserStakingInfo 계정 마이그레이션
   - `updatePoolSettings` - 풀 설정 업데이트

3. 계정 구조체 확장:
   - PoolState: 시간 기반 승수 관련 필드 추가
   - StakeInfo: 시간 기반 승수 및 마일스톤 관련 필드 추가
   - UserStakingInfo: 컬렉션 보너스 필드 추가

### 빌드 및 배포

```bash
# 프로젝트 폴더로 이동
cd /home/tesola/solana-projects/nft_staking_fixed

# Anchor 빌드
anchor build

# 프로그램 배포 (devnet 사용 예시)
solana program deploy --program-id 4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs target/deploy/nft_staking_fixed.so
```

## 2. 마이그레이션 스크립트 실행

기존 계정을 새 계정 구조로 마이그레이션하기 위한 스크립트를 실행합니다.

```bash
# 마이그레이션 스크립트 실행
node migration_script.js
```

마이그레이션 스크립트는 다음 작업을 수행합니다:

1. PoolState 업데이트:
   - max_nfts_per_user = 3
   - time_multiplier_increment = 500 (5%)
   - time_multiplier_period_days = 30
   - max_time_multiplier = 5000 (50%)

2. 모든 StakeInfo 계정 마이그레이션:
   - current_time_multiplier = 0 (초기값)
   - last_multiplier_update = 현재 시간
   - milestones_achieved = 0 (달성한 마일스톤 없음)
   - next_milestone_days = 30 (첫 마일스톤 30일)

3. 모든 UserStakingInfo 계정 마이그레이션:
   - collection_bonus = 스테이킹된 NFT 수에 따라 계산
     - 3개 이상: 2000 (20%)
     - 2개: 1000 (10%)
     - 1개 이하: 0 (보너스 없음)

## 3. 테스트 절차

마이그레이션 후 다음 사항을 테스트합니다:

1. 새로운 NFT 스테이킹:
   - 사용자당 최대 3개 NFT 스테이킹 가능 확인
   - 스테이킹 시 새 필드가 올바르게 초기화되는지 확인

2. 기존 스테이킹된 NFT:
   - 리워드 청구 기능이 여전히 작동하는지 확인
   - 시간 기반 승수가 올바르게 적용되는지 확인

3. 컬렉션 보너스:
   - 여러 NFT를 스테이킹할 때 보너스가 올바르게 적용되는지 확인
   - 언스테이킹 시 보너스가 올바르게 조정되는지 확인

## 4. 주의 사항

1. **데이터 백업**: 마이그레이션 전 반드시 기존 데이터 백업
2. **테스트넷 배포**: 먼저 테스트넷에서 전체 마이그레이션 과정 검증
3. **점진적 배포**: 사용자 혼란을 최소화하기 위해 단계적으로 배포 고려
4. **사용자 공지**: 변경 사항에 대해 사용자에게 미리 공지

## 5. 새로운 기능 요약

1. **사용자당 최대 NFT 수량 증가**: 기존 1개에서 3개로 증가
2. **시간 기반 보상 승수**: 스테이킹 기간 30일마다 5% 추가 보상, 최대 50%
3. **마일스톤 보상**: 특정 스테이킹 기간(30일, 90일, 180일, 365일) 달성 시 추가 보상
4. **컬렉션 보너스**: 여러 NFT 스테이킹 시 추가 보상
   - 2개: 10% 보너스
   - 3개 이상: 20% 보너스

이 업데이트로 장기 스테이킹과 더 많은 NFT 스테이킹을 장려하여 에코시스템의 안정성이 증가할 것으로 예상됩니다.