# TESOLA Onchain Enhancement Proposal v2: Extended Staking Features

This document builds upon the existing "Dynamic Reward Booster" proposal, adding new features to create a more comprehensive and engaging staking experience for TESOLA users.

## Existing Proposal Overview

The current "Dynamic Reward Booster" proposal introduces time-based reward multipliers for staked NFTs, rewarding users who stake for longer periods with increasing reward rates. The main components include:

1. Time-based multipliers that increase every 30 days
2. Maximum multiplier capped at 50% additional rewards
3. Automatic multiplier updates during reward claims
4. Enhanced UI to display multiplier information

## Additional Enhancement Proposals

To further improve the staking system, we propose the following additional features:

### 1. Milestone Achievement System

Implement special one-time rewards when users reach specific staking milestones:

#### Technical Implementation

```rust
pub struct StakeInfo {
    // Existing fields...
    
    // New fields for milestone tracking
    pub milestones_achieved: u8,  // Bitmap to track achieved milestones
    pub next_milestone_days: u64, // Days until next milestone
}

// Event for milestone achievement
#[event]
pub struct MilestoneAchieved {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub milestone_type: u8,  // 0=30-day, 1=90-day, 2=180-day, 3=365-day
    pub reward_amount: u64,
    pub timestamp: i64,
}

// Milestone reward calculation function
pub fn calculate_milestone_reward(
    stake_info: &StakeInfo,
    pool_state: &PoolState,
    current_time: i64
) -> Option<(u8, u64)> {
    let days_staked = (current_time - stake_info.staked_at) / 86400;
    
    // Define milestones (days and bitmap position)
    let milestones = [
        (30, 0),   // 30-day milestone, bit 0
        (90, 1),   // 90-day milestone, bit 1
        (180, 2),  // 180-day milestone, bit 2
        (365, 3),  // 365-day milestone, bit 3
    ];
    
    // Check if any milestone has been reached but not yet claimed
    for (days, bit_pos) in milestones.iter() {
        let bit_mask = 1 << bit_pos;
        
        // If days staked exceeds milestone days and milestone not yet achieved
        if days_staked >= *days as i64 && (stake_info.milestones_achieved & bit_mask) == 0 {
            // Calculate milestone bonus (percentage of base rewards)
            let bonus_percent = match bit_pos {
                0 => 5,    // 5% bonus for 30-day milestone
                1 => 10,   // 10% bonus for 90-day milestone
                2 => 15,   // 15% bonus for 180-day milestone
                3 => 25,   // 25% bonus for 365-day milestone
                _ => 0,
            };
            
            // Calculate actual reward amount
            let base_daily_reward = pool_state.reward_rate * tier_multiplier / 100;
            let milestone_reward = base_daily_reward * bonus_percent / 100 * 30; // 30 days worth of % bonus
            
            return Some((*bit_pos as u8, milestone_reward));
        }
    }
    
    None
}
```

### 2. Enhanced Auto-Compound System

Improve the existing auto-compound functionality with compound frequency options and compound streak bonuses:

#### Technical Implementation

```rust
pub struct StakeInfo {
    // Existing fields...
    
    // Enhanced auto-compound fields
    pub compound_frequency: u8,      // 0=daily, 1=weekly, 2=monthly, 255=manual
    pub last_compound_time: i64,     // Last time rewards were compounded
    pub compound_streak: u16,        // Consecutive successful compounds
    pub compound_streak_multiplier: u64, // Additional reward multiplier from compound streak
}

// Event for compound streak increase
#[event]
pub struct CompoundStreakIncreased {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub new_streak: u16,
    pub new_multiplier: u64,
    pub timestamp: i64,
}

// New instruction to set compound frequency
pub fn set_compound_frequency(
    ctx: Context<SetCompoundFrequency>,
    frequency: u8,
) -> Result<()> {
    // Validate frequency value
    require!(
        frequency == 0 || frequency == 1 || frequency == 2 || frequency == 255,
        StakingError::InvalidCompoundFrequency
    );
    
    let stake_info = &mut ctx.accounts.stake_info;
    
    // Update compound frequency
    let old_frequency = stake_info.compound_frequency;
    stake_info.compound_frequency = frequency;
    
    // Reset compound streak if switching to manual
    if frequency == 255 && old_frequency != 255 {
        stake_info.compound_streak = 0;
        stake_info.compound_streak_multiplier = 0;
    }
    
    // Emit event
    emit!(CompoundFrequencyChanged {
        user: ctx.accounts.owner.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        old_frequency,
        new_frequency: frequency,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

// Enhanced auto-compound logic with streak calculation
pub fn process_auto_compound(
    ctx: Context<ProcessAutoCompound>,
) -> Result<()> {
    let stake_info = &mut ctx.accounts.stake_info;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Check if it's time to compound based on frequency
    let compound_interval = match stake_info.compound_frequency {
        0 => 86400,     // Daily (24 hours)
        1 => 604800,    // Weekly (7 days)
        2 => 2592000,   // Monthly (30 days)
        _ => return Err(StakingError::InvalidCompoundFrequency.into()),
    };
    
    require!(
        current_time - stake_info.last_compound_time >= compound_interval,
        StakingError::CompoundTooEarly
    );
    
    // Calculate earned rewards since last claim/compound
    let earned_rewards = calculate_rewards(
        stake_info,
        &ctx.accounts.pool_state,
        current_time,
    )?;
    
    // Apply rewards to accumulated compound
    stake_info.accumulated_compound = stake_info.accumulated_compound
        .checked_add(earned_rewards)
        .ok_or(StakingError::ArithmeticError)?;
    
    // Update last compound time
    stake_info.last_compound_time = current_time;
    
    // Increase compound streak
    stake_info.compound_streak = stake_info.compound_streak
        .checked_add(1)
        .unwrap_or(65535); // Cap at max u16 value
        
    // Update streak multiplier (every 5 consecutive compounds = +1% bonus, max 10%)
    stake_info.compound_streak_multiplier = std::cmp::min(
        (stake_info.compound_streak / 5) as u64 * 100, // +1% per 5 streaks
        1000 // 10% max bonus
    );
    
    // Emit events
    emit!(RewardsCompounded {
        user: ctx.accounts.owner.key(),
        amount: earned_rewards,
        new_total: stake_info.accumulated_compound,
        nft_mint: ctx.accounts.nft_mint.key(),
        timestamp: current_time,
    });
    
    if stake_info.compound_streak % 5 == 0 {
        emit!(CompoundStreakIncreased {
            user: ctx.accounts.owner.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            new_streak: stake_info.compound_streak,
            new_multiplier: stake_info.compound_streak_multiplier,
            timestamp: current_time,
        });
    }
    
    Ok(())
}
```

### 3. Collection Staking Bonus

Introduce a bonus for users who stake multiple NFTs from the same collection, encouraging collectors to stake their entire collection:

#### Technical Implementation

```rust
pub struct UserStakingInfo {
    // Existing fields...
    
    // Collection bonus fields
    pub collection_bonus: u64,  // Additional bonus (base points, 500 = 5%)
}

// Event for collection bonus updates
#[event]
pub struct CollectionBonusUpdated {
    pub user: Pubkey,
    pub staked_count: u8,
    pub new_bonus: u64,
    pub timestamp: i64,
}

// Function to update collection bonus when staking/unstaking
pub fn update_collection_bonus(
    user_staking_info: &mut UserStakingInfo,
    pool_state: &PoolState,
) -> Result<bool> {
    let staked_count = user_staking_info.staked_mints.len() as u8;
    
    // Calculate new bonus based on number of staked NFTs
    let new_bonus = if staked_count >= 21 {
        2000 // 20% for 21+ NFTs
    } else if staked_count >= 11 {
        1500 // 15% for 11-20 NFTs
    } else if staked_count >= 6 {
        1000 // 10% for 6-10 NFTs
    } else if staked_count >= 3 {
        500  // 5% for 3-5 NFTs
    } else {
        0    // No bonus for fewer than 3 NFTs
    };
    
    // Check if bonus changed
    let bonus_changed = new_bonus != user_staking_info.collection_bonus;
    
    // Update bonus if changed
    if bonus_changed {
        user_staking_info.collection_bonus = new_bonus;
    }
    
    Ok(bonus_changed)
}

// Modify stake_nft and unstake_nft instructions to update collection bonus
pub fn stake_nft(ctx: Context<StakeNft>, staking_period: u64, nft_tier: u8, auto_compound: bool) -> Result<()> {
    // Existing staking logic...
    
    // Add NFT to user's staked NFTs list
    ctx.accounts.user_staking_info.staked_mints.push(ctx.accounts.nft_mint.key());
    ctx.accounts.user_staking_info.staked_count += 1;
    
    // Update collection bonus
    let bonus_changed = update_collection_bonus(
        &mut ctx.accounts.user_staking_info,
        &ctx.accounts.pool_state,
    )?;
    
    // Emit collection bonus event if changed
    if bonus_changed {
        emit!(CollectionBonusUpdated {
            user: ctx.accounts.owner.key(),
            staked_count: ctx.accounts.user_staking_info.staked_count,
            new_bonus: ctx.accounts.user_staking_info.collection_bonus,
            timestamp: Clock::get()?.unix_timestamp,
        });
    }
    
    Ok(())
}
```

### 4. Emergency Unstaking with Reduced Penalty

Add a more flexible emergency unstaking option with dynamic penalties based on staking duration:

#### Technical Implementation

```rust
// New instruction for emergency unstaking
pub fn emergency_unstake_nft(
    ctx: Context<EmergencyUnstakeNft>,
) -> Result<()> {
    let stake_info = &ctx.accounts.stake_info;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Calculate staking duration so far
    let staking_duration = current_time - stake_info.staked_at;
    let staking_duration_days = staking_duration / 86400;
    let staking_period_days = stake_info.staking_period / 86400;
    
    // Calculate progress percentage (0-100)
    let progress_percentage = (staking_duration_days * 100) / staking_period_days;
    
    // Calculate penalty percentage based on progress
    let penalty_percentage = if progress_percentage < 30 {
        50 // 50% penalty if < 30% complete
    } else if progress_percentage < 60 {
        30 // 30% penalty if 30-60% complete
    } else if progress_percentage < 90 {
        15 // 15% penalty if 60-90% complete
    } else {
        5  // 5% penalty if >= 90% complete
    };
    
    // Calculate earned rewards
    let earned_rewards = calculate_rewards(
        stake_info,
        &ctx.accounts.pool_state,
        current_time,
    )?;
    
    // Apply penalty to rewards
    let penalty_amount = (earned_rewards * penalty_percentage) / 100;
    let final_rewards = earned_rewards - penalty_amount;
    
    // Process unstaking (similar to regular unstaking logic)
    // ...
    
    // Emit emergency unstaking event
    emit!(EmergencyUnstaked {
        user: ctx.accounts.owner.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        earned_rewards,
        penalty_amount,
        final_rewards,
        progress_percentage: progress_percentage as u8,
        timestamp: current_time,
    });
    
    Ok(())
}
```

## Integration with JavaScript Client

The following JavaScript functions should be added to the `stakingService.js` file to support these new features:

```javascript
/**
 * Get milestone status for staked NFTs
 * 
 * @param {string} wallet - Wallet address
 * @returns {Promise<Object>} - Milestone information for each staked NFT
 */
export async function getMilestoneStatus(wallet) {
  try {
    return await api.get(`${endpoints.staking.getMilestones}?wallet=${wallet}`);
  } catch (error) {
    console.error('Failed to get milestone status:', error);
    throw error;
  }
}

/**
 * Set auto-compound frequency for a staked NFT
 * 
 * @param {Object} data - Compound frequency data
 * @param {string} data.nftMint - NFT mint address
 * @param {number} data.frequency - Compound frequency (0=daily, 1=weekly, 2=monthly, 255=manual)
 * @returns {Promise<Object>} - Update result
 */
export async function setCompoundFrequency(data) {
  try {
    return await api.post(endpoints.staking.setCompoundFrequency, data);
  } catch (error) {
    console.error('Failed to set compound frequency:', error);
    throw error;
  }
}

/**
 * Perform emergency unstaking of an NFT
 * 
 * @param {Object} data - Unstaking data including wallet and NFT mint addresses
 * @returns {Promise<Object>} - Transaction data for emergency unstaking
 */
export async function prepareEmergencyUnstaking(data) {
  try {
    return await api.post(endpoints.staking.prepareEmergencyUnstaking, data);
  } catch (error) {
    console.error('Failed to prepare emergency unstaking:', error);
    throw error;
  }
}

/**
 * Complete emergency unstaking process
 * 
 * @param {Object} data - Transaction signature and data
 * @returns {Promise<Object>} - Emergency unstaking result with penalty information
 */
export async function completeEmergencyUnstaking(data) {
  try {
    return await api.post(endpoints.staking.completeEmergencyUnstaking, data);
  } catch (error) {
    console.error('Failed to complete emergency unstaking:', error);
    throw error;
  }
}

/**
 * Calculate penalty for emergency unstaking
 * 
 * @param {Object} nft - Staked NFT information
 * @returns {Object} - Penalty calculation including percentage and amount
 */
export function calculateEmergencyUnstakingPenalty(nft) {
  // Get staking duration so far
  const stakingStartDate = new Date(nft.staked_at);
  const currentDate = new Date();
  const stakingDurationMs = currentDate - stakingStartDate;
  const stakingDurationDays = stakingDurationMs / (1000 * 60 * 60 * 24);
  
  // Get total staking period
  const stakingPeriodDays = nft.staking_period;
  
  // Calculate progress percentage
  const progressPercentage = (stakingDurationDays / stakingPeriodDays) * 100;
  
  // Calculate penalty percentage based on progress
  let penaltyPercentage = 0;
  if (progressPercentage < 30) {
    penaltyPercentage = 50; // 50% penalty if < 30% complete
  } else if (progressPercentage < 60) {
    penaltyPercentage = 30; // 30% penalty if 30-60% complete
  } else if (progressPercentage < 90) {
    penaltyPercentage = 15; // 15% penalty if 60-90% complete
  } else {
    penaltyPercentage = 5;  // 5% penalty if >= 90% complete
  }
  
  // Calculate estimated earned rewards
  const estimatedRewards = nft.earned_so_far || 0;
  
  // Apply penalty to rewards
  const penaltyAmount = (estimatedRewards * penaltyPercentage) / 100;
  const finalRewards = estimatedRewards - penaltyAmount;
  
  return {
    progressPercentage,
    penaltyPercentage,
    penaltyAmount,
    earnedRewards: estimatedRewards,
    finalRewards
  };
}
```

## API Endpoint Updates

The following new API endpoints will need to be added to support these features:

```javascript
// Add to endpoints object in api.js
export const endpoints = {
  // Existing endpoints...
  
  staking: {
    // Existing endpoints...
    getMilestones: '/api/staking/getMilestones',
    setCompoundFrequency: '/api/staking/setCompoundFrequency',
    prepareEmergencyUnstaking: '/api/staking/prepareEmergencyUnstaking',
    completeEmergencyUnstaking: '/api/staking/completeEmergencyUnstaking',
  },
  
  // Other endpoints...
};
```

## User Interface Enhancements

To properly showcase these new features, the following UI components should be added:

1. **Milestone Progress Panel**
   - Visual timeline of milestone achievements
   - Countdown to next milestone
   - History of achieved milestones

2. **Auto-Compound Settings**
   - Frequency selection dropdown (Daily, Weekly, Monthly, Manual)
   - Compound streak display with boost percentage
   - Next scheduled compound countdown

3. **Collection Bonus Indicator**
   - Visual representation of staked collection progress
   - Current bonus percentage display
   - Required NFTs for next bonus tier

4. **Emergency Unstaking Dialog**
   - Clear penalty calculation and preview
   - Warning about lost rewards
   - Confirmation flow to prevent accidents

## Migration Strategy

1. **Program Update**
   - Deploy updated program preserving backward compatibility
   - Initialize new account fields with sensible defaults
   - Set up event listeners for new event types

2. **Database Schema Update**
   - Add new columns to staking-related tables
   - Create new tables for milestone tracking and compound history

3. **Backend Integration**
   - Implement new API endpoints for milestone tracking, compound settings, etc.
   - Update existing reward calculation logic to include new bonuses

4. **Frontend Rollout**
   - Develop new UI components
   - Implement feature flags for gradual release
   - Create tutorials and help materials for new features

## Implementation Timeline

1. **Week 1-2: Development**
   - On-chain program enhancements
   - Database schema updates
   - API endpoint implementation

2. **Week 3: Testing**
   - Integration testing
   - Security review
   - Performance optimization

3. **Week 4: Deployment**
   - Testnet deployment
   - Community testing period
   - Final adjustments

4. **Week 5: Mainnet Release**
   - Gradual feature rollout
   - Monitoring and metrics collection
   - User education and support

## Conclusion

These enhanced staking features build upon the "Dynamic Reward Booster" to create a more engaging, rewarding, and flexible staking system for TESOLA users. By implementing milestones, improved auto-compound options, collection bonuses, and more flexible emergency unstaking, we can significantly improve user engagement and retention while maintaining a healthy ecosystem.

These enhancements will serve as a strong foundation for future gamification elements and help differentiate TESOLA's staking system from competitors in the space.