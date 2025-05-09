# TESOLA 온체인 스테이킹 시스템 업데이트 계획

## 업데이트 목표

1. Dynamic Reward Booster 시스템 구현 - 장기 스테이킹에 대한 보상 증가
2. 사용자당 최대 스테이킹 NFT 수량을 1개에서 3개로 증가
3. 컬렉션 스테이킹 보너스 - 여러 NFT를 스테이킹하는 사용자에게 추가 보상

## 업데이트 내용

### 1. PoolState 구조체 확장

기존 PoolState 계정 구조체에 다음 필드 추가:

```rust
pub struct PoolState {
    // 기존 필드...
    
    // 새로운 필드
    pub time_multiplier_increment: u64,    // 30일마다 증가하는 승수 (예: 500 = 5%)
    pub time_multiplier_period_days: u64,  // 승수 증가 기간 (예: 30일)
    pub max_time_multiplier: u64,          // 최대 시간 기반 승수 (예: 5000 = 50%)
}
```

### 2. StakeInfo 구조체 확장

기존 StakeInfo 계정 구조체에 다음 필드 추가:

```rust
pub struct StakeInfo {
    // 기존 필드...
    
    // 새로운 필드
    pub current_time_multiplier: u64,     // 현재 적용되는 시간 기반 승수
    pub last_multiplier_update: i64,      // 마지막 승수 업데이트 시간
    pub milestones_achieved: u8,          // 달성한 마일스톤 비트맵
    pub next_milestone_days: u64,         // 다음 마일스톤까지 남은 일수
}
```

### 3. UserStakingInfo 구조체 확장

기존 UserStakingInfo 계정 구조체에 다음 필드 추가:

```rust
pub struct UserStakingInfo {
    // 기존 필드...
    
    // 새로운 필드
    pub collection_bonus: u64,  // 컬렉션 보너스 (basis points)
}
```

### 4. 사용자당 최대 NFT 수량 변경

`initialize` 함수에서 `max_nfts_per_user` 값을 3으로 설정:

```rust
pool_state.max_nfts_per_user = 3;  // 기존 1에서 3으로 변경
```

### 5. 시간 기반 승수 업데이트 명령어 추가

새로운 명령어 `update_time_multiplier` 추가:

```rust
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
        
        // 마일스톤 확인 및 처리
        check_and_process_milestone(ctx, current_time)?;
        
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

### 6. claim_rewards 함수 수정

기존 `claim_rewards` 함수를, 시간 기반 승수와 컬렉션 보너스를 적용하도록 수정:

```rust
pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    // 기존 코드...
    
    // 시간 기반 승수 자동 업데이트
    let stake_info = &mut ctx.accounts.stake_info;
    let pool_state = &ctx.accounts.pool_state;
    let current_time = Clock::get()?.unix_timestamp;
    
    // 스테이킹 경과 일수 계산
    let days_staked = (current_time - stake_info.staked_at) / 86400;
    
    // 승수 기간 수 계산
    let multiplier_periods = (days_staked / pool_state.time_multiplier_period_days as i64) as u64;
    
    // 새 승수 계산 (최대값 제한)
    let new_multiplier = std::cmp::min(
        multiplier_periods * pool_state.time_multiplier_increment,
        pool_state.max_time_multiplier
    );
    
    // 승수가 증가한 경우 업데이트
    if new_multiplier > stake_info.current_time_multiplier {
        stake_info.current_time_multiplier = new_multiplier;
        stake_info.last_multiplier_update = current_time;
        
        // 마일스톤 확인 및 처리
        check_and_process_milestone(ctx, current_time)?;
    }
    
    // 보상 계산 로직에 시간 기반 승수 및 컬렉션 보너스 적용
    // 기존 코드는 유지하되, 아래 코드 추가
    
    // 시간 기반 승수 적용
    let time_bonus_multiplier = 100 + (stake_info.current_time_multiplier / 100);
    
    // 컬렉션 보너스 적용 (사용자 스테이킹 정보에서)
    let user_staking_info = &ctx.accounts.user_staking_info;
    let collection_bonus_multiplier = 100 + (user_staking_info.collection_bonus / 100);
    
    // 최종 보상 계산 (기존 보상 * 시간 승수 * 컬렉션 보너스)
    let enhanced_reward = base_reward * time_bonus_multiplier * collection_bonus_multiplier / 10000;
    
    // 최종 보상 지급 (기존 로직 대체)
    let total_reward = enhanced_reward;
    
    // 나머지 기존 코드...
    
    Ok(())
}
```

### 7. stake_nft 함수 수정

NFT 스테이킹 시 새 필드 초기화:

```rust
pub fn stake_nft(ctx: Context<StakeNft>, staking_period: u64, nft_tier: u8, auto_compound: bool) -> Result<()> {
    // 기존 코드...
    
    // 새 필드 초기화
    stake_info.current_time_multiplier = 0;
    stake_info.last_multiplier_update = current_time;
    stake_info.milestones_achieved = 0;
    stake_info.next_milestone_days = 30; // 첫 마일스톤 30일
    
    // 스테이킹 후 컬렉션 보너스 업데이트
    update_collection_bonus(user_staking_info)?;
    
    // 나머지 기존 코드...
    
    Ok(())
}
```

### 8. 새 이벤트 및 헬퍼 함수 추가

```rust
// 새 이벤트 정의
#[event]
pub struct MultiplierUpdated {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub new_multiplier: u64,
    pub days_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct MilestoneAchieved {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub milestone_type: u8,
    pub reward_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CollectionBonusUpdated {
    pub user: Pubkey,
    pub staked_count: u8,
    pub new_bonus: u64,
    pub timestamp: i64,
}

// 컬렉션 보너스 업데이트 헬퍼 함수
fn update_collection_bonus(user_staking_info: &mut UserStakingInfo) -> Result<()> {
    let staked_count = user_staking_info.staked_count;
    
    // 스테이킹된 NFT 수에 따른 보너스 계산
    let new_bonus = if staked_count >= 3 {
        2000 // 3개: 20% 보너스
    } else if staked_count == 2 {
        1000 // 2개: 10% 보너스 
    } else {
        0    // 1개: 보너스 없음
    };
    
    // 보너스 변화 여부 확인
    let bonus_changed = new_bonus != user_staking_info.collection_bonus;
    
    // 변화가 있을 경우 업데이트
    if bonus_changed {
        user_staking_info.collection_bonus = new_bonus;
        
        // 이벤트 발생 로직은 호출자에서 처리
    }
    
    Ok(())
}

// 마일스톤 처리 헬퍼 함수
fn check_and_process_milestone(ctx: Context<ClaimRewards>, current_time: i64) -> Result<()> {
    let stake_info = &mut ctx.accounts.stake_info;
    
    // 스테이킹 경과 일수 계산
    let days_staked = (current_time - stake_info.staked_at) / 86400;
    
    // 마일스톤 정의
    let milestones = [
        (30, 0, 5),    // 30일 마일스톤, 비트 0, 5% 보너스
        (90, 1, 10),   // 90일 마일스톤, 비트 1, 10% 보너스
        (180, 2, 15),  // 180일 마일스톤, 비트 2, 15% 보너스
        (365, 3, 25),  // 365일 마일스톤, 비트 3, 25% 보너스
    ];
    
    // 달성 가능한 마일스톤 확인
    for &(days, bit_pos, bonus_percent) in milestones.iter() {
        let bit_mask = 1u8 << bit_pos;
        
        // 마일스톤 일수를 초과했고 아직 달성하지 않은 경우
        if days_staked >= days as i64 && (stake_info.milestones_achieved & bit_mask) == 0 {
            // 마일스톤 달성 표시
            stake_info.milestones_achieved |= bit_mask;
            
            // 마일스톤 보상 계산 로직
            // ...
            
            // 이벤트 발생
            emit!(MilestoneAchieved {
                user: ctx.accounts.user.key(),
                nft_mint: ctx.accounts.nft_mint.key(),
                milestone_type: bit_pos as u8,
                reward_amount: 0, // 보상 계산 결과
                timestamp: current_time,
            });
        }
    }
    
    Ok(())
}
```

## 구현 계획

1. 먼저 PoolState, StakeInfo, UserStakingInfo 구조체 확장
2. `initialize` 함수에서 `max_nfts_per_user` 값을 3으로 변경
3. `update_time_multiplier` 명령어 추가
4. `claim_rewards` 함수 수정 - 시간 기반 승수 및 컬렉션 보너스 적용
5. `stake_nft` 함수 수정 - 새 필드 초기화 및 컬렉션 보너스 업데이트
6. 새 이벤트 및 헬퍼 함수 추가

### NFT당 최대 스테이킹 개수 변경

사용자당 최대 스테이킹 NFT 개수를 3개로 변경하기 위해 PoolState 초기화 함수에서 다음과 같이 수정:

```rust
// 기존 코드
pool_state.max_nfts_per_user = 5;    // Maximum 5 NFTs per user

// 새 코드
pool_state.max_nfts_per_user = 3;    // Maximum 3 NFTs per user
```

이 변경으로 사용자당 최대 3개의 NFT를 스테이킹할 수 있게 됩니다.