# TESOLA 온체인 스테이킹 개선 계획: Dynamic Reward Booster

## 개요

"Dynamic Reward Booster"는 사용자가 NFT를 장기간 스테이킹할 경우 보상이 점진적으로 증가하는 시스템을 도입하여 스테이킹 참여 및 지속성을 강화하는 기능입니다. 이 제안은 기존의 tier-multiplier 외에도 시간 기반 승수를 추가하여 장기 스테이커를 위한 추가 인센티브를 제공합니다.

## 현재 시스템 분석

현재 TESOLA 스테이킹 시스템은 다음과 같은 구조를 가지고 있습니다:

1. **기본 보상률** (`reward_rate`): 기본 일일 보상 비율
2. **등급 승수** (`tier_multiplier`): NFT 희귀도에 따른 보상 승수
   - Common, Rare, Epic, Legendary 등급별 승수 적용
3. **스테이킹 기간** (`staking_period`): 락업 기간
4. **Auto-Compound**: 보상을 자동으로 재투자하는 옵션

이 시스템을 확장하여 스테이킹 지속 시간에 따른 보상 승수를 추가하고자 합니다.

## 제안하는 기능: Dynamic Reward Booster

### 1. 기본 개념

스테이킹 지속 시간에 따라 자동으로 보상 승수가 증가하며, 이는 기존의 등급 승수와 곱해집니다.

### 2. 주요 구성 요소

1. **시간 기반 승수 (Time-Based Multiplier)**
   - 스테이킹 시작 후 특정 기간이 지나면 승수가 점진적으로 증가
   - 예: 30일마다 5%씩 보상 승수 증가, 최대 50%까지

2. **보상 계산 공식 업데이트**
   ```
   일일 보상 = 기본 보상률 × 등급 승수 × (1 + 시간 기반 승수)
   ```

3. **보상 캡 (Reward Cap)**
   - 지나친 인플레이션을 방지하기 위한 최대 시간 기반 승수 설정
   - 제안: 최대 50% 추가 보상 (1.5배)

4. **이벤트 발생**
   - 사용자가 새로운 시간 기반 보상 등급에 도달할 때마다 이벤트 발생
   - 프론트엔드에서 사용자에게 알림 제공

### 3. 스마트 컨트랙트 변경 사항

#### PoolState 계정 구조 확장
```rust
pub struct PoolState {
    pub admin: Pubkey,
    pub reward_rate: u64,
    pub emergency_fee_percent: u8,
    pub paused: bool,
    pub total_staked: u64,
    // 기존 필드...
    
    // 새로운 필드
    pub time_multiplier_increment: u64,    // 30일마다 증가하는 승수 (예: 500 = 5%)
    pub time_multiplier_period_days: u64,  // 승수 증가 기간 (예: 30일)
    pub max_time_multiplier: u64,          // 최대 시간 기반 승수 (예: 5000 = 50%)
}
```

#### StakeInfo 계정 확장
```rust
pub struct StakeInfo {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub staked_at: i64,
    pub release_date: i64,
    pub is_staked: bool,
    pub tier: u8,
    pub last_claim_time: i64,
    pub staking_period: u64,
    pub auto_compound: bool,
    pub accumulated_compound: u64,
    
    // 새로운 필드
    pub current_time_multiplier: u64,     // 현재 적용되는 시간 기반 승수
    pub last_multiplier_update: i64,      // 마지막 승수 업데이트 시간
}
```

#### 새 명령어 추가
```rust
#[derive(Accounts)]
pub struct UpdateTimeMultiplier<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"stake", nft_mint.key().as_ref()],
        bump,
        constraint = stake_info.owner == owner.key() @ StakingError::NotOwner,
        constraint = stake_info.is_staked == true @ StakingError::NotStaked,
    )]
    pub stake_info: Account<'info, StakeInfo>,
    
    pub pool_state: Account<'info, PoolState>,
}

pub fn update_time_multiplier(ctx: Context<UpdateTimeMultiplier>) -> Result<()> {
    let stake_info = &mut ctx.accounts.stake_info;
    let pool = &ctx.accounts.pool_state;
    let current_time = Clock::get()?.unix_timestamp;
    
    // 스테이킹 경과 일수 계산
    let days_staked = (current_time - stake_info.staked_at) / 86400;
    
    // 승수 기간 수 계산
    let multiplier_periods = (days_staked / pool.time_multiplier_period_days as i64) as u64;
    
    // 새 승수 계산 (최대값 제한)
    let new_multiplier = std::cmp::min(
        multiplier_periods * pool.time_multiplier_increment,
        pool.max_time_multiplier
    );
    
    // 승수가 증가한 경우에만 업데이트
    if new_multiplier > stake_info.current_time_multiplier {
        stake_info.current_time_multiplier = new_multiplier;
        stake_info.last_multiplier_update = current_time;
        
        // 이벤트 발생
        emit!(MultiplierUpdated {
            user: ctx.accounts.owner.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            new_multiplier,
            days_staked: days_staked as u64,
            timestamp: current_time,
        });
    }
    
    Ok(())
}
```

#### 보상 계산 로직 업데이트
```rust
// 기존 보상 계산 코드 수정
let daily_reward = pool_state.reward_rate
    .checked_mul(tier_multiplier).ok_or(StakingError::ArithmeticError)?
    // 시간 기반 승수 적용
    .checked_mul(10000 + stake_info.current_time_multiplier).ok_or(StakingError::ArithmeticError)?
    .checked_div(10000).ok_or(StakingError::ArithmeticError)?;
```

#### 자동 승수 업데이트 트리거

claim_rewards 명령어에 시간 기반 승수 자동 업데이트 로직 추가:

```rust
pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    // 기존 코드...
    
    // 시간 기반 승수 자동 업데이트
    let days_staked = (current_time - stake_info.staked_at) / 86400;
    let multiplier_periods = (days_staked / pool.time_multiplier_period_days as i64) as u64;
    let new_multiplier = std::cmp::min(
        multiplier_periods * pool.time_multiplier_increment,
        pool.max_time_multiplier
    );
    
    // 승수가 증가한 경우 업데이트
    if new_multiplier > stake_info.current_time_multiplier {
        let old_multiplier = stake_info.current_time_multiplier;
        stake_info.current_time_multiplier = new_multiplier;
        stake_info.last_multiplier_update = current_time;
        
        // 이벤트 발생
        emit!(MultiplierUpdated {
            user: ctx.accounts.user.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            old_multiplier,
            new_multiplier,
            days_staked: days_staked as u64,
            timestamp: current_time,
        });
    }
    
    // 기존 코드 계속...
}
```

### 4. 오프체인 구성 요소

1. **동기화 시스템 업데이트**
   - 새로운 시간 기반 승수 필드를 포함하도록 스테이킹 레코드 스키마 확장
   - 블록체인 데이터를 읽을 때 새 필드 추출

2. **사용자 인터페이스 개선**
   - 스테이킹 대시보드에 현재 시간 기반 승수 표시
   - 다음 승수 증가까지 남은 시간 카운트다운
   - 승수 증가 시 알림 시스템

3. **관리자 도구 확장**
   - 시간 기반 승수 파라미터 설정 인터페이스
   - 승수 통계 모니터링

## 구현 계획

### 1. 온체인 구현

1. **Rust 프로그램 업데이트**
   - PoolState, StakeInfo 구조체 확장
   - 새로운 명령어 및 이벤트 추가
   - 보상 계산 로직 업데이트

2. **프로그램 마이그레이션**
   - 기존 스테이킹 계정을 새 구조로 마이그레이션하는 스크립트 개발
   - 테스트넷에서 마이그레이션 테스트

### 2. 오프체인 구현

1. **데이터베이스 스키마 업데이트**
   - nft_staking 테이블에 시간 기반 승수 필드 추가
   - 승수 업데이트 이벤트를 위한 새 테이블 생성

2. **동기화 시스템 업데이트**
   - 새 필드를 포함하도록 getStakeInfoFromChain 함수 수정
   - 시간 기반 승수 이벤트 처리기 추가

3. **프론트엔드 구현**
   - 시간 기반 승수 정보 표시 컴포넌트 개발
   - 승수 업데이트 알림 시스템 구현

### 3. 테스트 및 품질 보증

1. **단위 테스트**
   - 온체인 코드 단위 테스트
   - 승수 계산 테스트 케이스

2. **통합 테스트**
   - 전체 스테이킹 워크플로우 테스트
   - 장기 스테이킹 시나리오 시뮬레이션
   - 대규모 데이터셋에서의 성능 테스트

## 이점 및 기대 효과

1. **장기 스테이킹 장려**
   - 장기 보유자를 위한 추가 인센티브 제공
   - NFT 가격 안정화에 기여

2. **사용자 경험 개선**
   - 보상 증가를 통한 지속적인 참여 유도
   - 보상 증가의 게임화 요소 추가

3. **생태계 안정성**
   - 지속적인 스테이킹을 통한 유동성 안정화
   - 장기 참여자를 위한 더 높은 APY 제공

## 위험 및 완화 전략

1. **토큰 인플레이션**
   - 위험: 증가된 보상이 과도한 토큰 발행으로 이어질 수 있음
   - 완화: 최대 승수 제한 및 전체 발행량 모니터링

2. **마이그레이션 위험**
   - 위험: 기존 스테이킹 계정 마이그레이션 중 오류 가능성
   - 완화: 철저한 테스트넷 테스트 및 점진적 마이그레이션

3. **복잡성 증가**
   - 위험: 사용자가 복잡한 보상 시스템을 이해하기 어려울 수 있음
   - 완화: 명확한 UI/UX 및 사용자 가이드 제공

## 결론

Dynamic Reward Booster는 TESOLA 스테이킹 시스템에 시간 기반 보상 증가 메커니즘을 도입하여 장기 스테이커에게 추가 인센티브를 제공합니다. 이 기능은 NFT 생태계의 안정성을 높이고 사용자 참여를 촉진하며, 장기적으로 TESOLA 토큰과 SOLARA NFT 컬렉션의 가치를 향상시킬 것으로 기대됩니다.

온체인 프로그램 업데이트와 오프체인 시스템 연동을 통해 완전한 기능성을 제공하며, 철저한 테스트와 점진적 배포를 통해 안전하게 구현될 것입니다.