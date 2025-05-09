use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};

declare_id!("4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs");

#[program]
pub mod nft_staking_enhanced {
    use super::*;

    /// Updates the time-based multiplier for a staked NFT
    pub fn update_time_multiplier(ctx: Context<UpdateTimeMultiplier>) -> Result<()> {
        let stake_info = &mut ctx.accounts.stake_info;
        let pool = &ctx.accounts.pool_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if NFT is staked
        require!(stake_info.is_staked, StakingError::NotStaked);
        require!(!pool.paused, StakingError::PoolPaused);
        
        // Calculate staking duration in days
        let days_staked = (current_time - stake_info.staked_at) / 86400;
        
        // Calculate periods completed (e.g., 30-day periods)
        let multiplier_periods = (days_staked / pool.time_multiplier_period_days as i64) as u64;
        
        // Calculate new multiplier (with maximum cap)
        let new_multiplier = std::cmp::min(
            multiplier_periods.saturating_mul(pool.time_multiplier_increment),
            pool.max_time_multiplier
        );
        
        // Only update if multiplier has increased
        if new_multiplier > stake_info.current_time_multiplier {
            let old_multiplier = stake_info.current_time_multiplier;
            stake_info.current_time_multiplier = new_multiplier;
            stake_info.last_multiplier_update = current_time;
            
            // Check for milestone achievement
            check_and_process_milestone(ctx.accounts, current_time)?;
            
            // Emit multiplier updated event
            emit!(MultiplierUpdated {
                user: ctx.accounts.owner.key(),
                nft_mint: ctx.accounts.nft_mint.key(),
                old_multiplier,
                new_multiplier,
                days_staked: days_staked as u64,
                timestamp: current_time,
            });
        }
        
        Ok(())
    }

    /// Process auto-compound for a staked NFT
    pub fn process_auto_compound(ctx: Context<ProcessAutoCompound>) -> Result<()> {
        let stake_info = &mut ctx.accounts.stake_info;
        let pool_state = &ctx.accounts.pool_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if NFT is staked
        require!(stake_info.is_staked, StakingError::NotStaked);
        require!(!pool_state.paused, StakingError::PoolPaused);
        require!(stake_info.auto_compound, StakingError::AutoCompoundNotEnabled);
        
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
            pool_state,
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
        let old_multiplier = stake_info.compound_streak_multiplier;
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
        
        // Emit streak event if multiplier changed
        if stake_info.compound_streak_multiplier != old_multiplier {
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

    /// Set auto-compound frequency for a staked NFT
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
    
    /// Emergency unstaking with dynamic penalty
    pub fn emergency_unstake_nft(
        ctx: Context<EmergencyUnstakeNft>,
    ) -> Result<()> {
        let stake_info = &mut ctx.accounts.stake_info;
        let pool_state = &ctx.accounts.pool_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if NFT is staked
        require!(stake_info.is_staked, StakingError::NotStaked);
        require!(!pool_state.paused, StakingError::PoolPaused);
        
        // Calculate staking duration so far
        let staking_duration = current_time - stake_info.staked_at;
        let staking_duration_days = staking_duration / 86400;
        let staking_period_days = stake_info.staking_period as i64;
        
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
            pool_state,
            current_time,
        )?;
        
        // Apply penalty to rewards
        let penalty_amount = (earned_rewards * penalty_percentage as u64) / 100;
        let final_rewards = earned_rewards.saturating_sub(penalty_amount);
        
        // Process unstaking (token transfer logic would be here)
        // This requires detailed implementation of token transfers
        // Similar to regular unstaking but with penalty application
        
        // Update user staking info
        let user_staking_info = &mut ctx.accounts.user_staking_info;
        
        // Remove NFT from user's staked list
        if let Some(index) = user_staking_info.staked_mints.iter().position(|&mint| mint == ctx.accounts.nft_mint.key()) {
            user_staking_info.staked_mints.remove(index);
            user_staking_info.staked_count = user_staking_info.staked_count.saturating_sub(1);
        }
        
        // Update collection bonus
        let bonus_changed = update_collection_bonus(
            user_staking_info,
            pool_state,
        )?;
        
        // Mark NFT as unstaked
        stake_info.is_staked = false;
        
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
        
        // Emit collection bonus event if changed
        if bonus_changed {
            emit!(CollectionBonusUpdated {
                user: ctx.accounts.owner.key(),
                staked_count: user_staking_info.staked_count,
                new_bonus: user_staking_info.collection_bonus,
                timestamp: current_time,
            });
        }
        
        Ok(())
    }
    
    // Existing stake_nft function with collection bonus update
    pub fn stake_nft(
        ctx: Context<StakeNft>, 
        staking_period: u64, 
        nft_tier: u8, 
        auto_compound: bool
    ) -> Result<()> {
        // Existing staking logic...
        // We're extending the implementation to handle collection bonuses
        
        let stake_info = &mut ctx.accounts.stake_info;
        let user_staking_info = &mut ctx.accounts.user_staking_info;
        let pool_state = &ctx.accounts.pool_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Validate inputs
        require!(!pool_state.paused, StakingError::PoolPaused);
        require!(nft_tier <= 3, StakingError::InvalidNftTier); // 0=Common, 1=Rare, 2=Epic, 3=Legendary
        require!(staking_period > 0, StakingError::InvalidStakingPeriod);
        
        // Check max NFTs per user
        require!(
            user_staking_info.staked_count < pool_state.max_nfts_per_user,
            StakingError::MaxNftsExceeded
        );
        
        // Set up stake info
        stake_info.owner = ctx.accounts.owner.key();
        stake_info.mint = ctx.accounts.nft_mint.key();
        stake_info.staked_at = current_time;
        stake_info.release_date = current_time + (staking_period as i64 * 86400); // Convert days to seconds
        stake_info.is_staked = true;
        stake_info.tier = nft_tier;
        stake_info.last_claim_time = current_time;
        stake_info.staking_period = staking_period;
        stake_info.auto_compound = auto_compound;
        stake_info.accumulated_compound = 0;
        
        // Initialize new fields for enhanced features
        stake_info.current_time_multiplier = 0;
        stake_info.last_multiplier_update = current_time;
        stake_info.milestones_achieved = 0;
        stake_info.next_milestone_days = 30; // First milestone at 30 days
        stake_info.compound_frequency = if auto_compound { 0 } else { 255 }; // Default to daily if auto-compound enabled
        stake_info.last_compound_time = current_time;
        stake_info.compound_streak = 0;
        stake_info.compound_streak_multiplier = 0;
        
        // Add NFT to user's staked list
        user_staking_info.staked_mints.push(ctx.accounts.nft_mint.key());
        user_staking_info.staked_count += 1;
        
        // Update collection bonus
        let bonus_changed = update_collection_bonus(
            user_staking_info,
            pool_state,
        )?;
        
        // Emit staking event
        emit!(NftStaked {
            user: ctx.accounts.owner.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            timestamp: current_time,
            tier: nft_tier,
            staking_period,
        });
        
        // Emit collection bonus event if changed
        if bonus_changed {
            emit!(CollectionBonusUpdated {
                user: ctx.accounts.owner.key(),
                staked_count: user_staking_info.staked_count,
                new_bonus: user_staking_info.collection_bonus,
                timestamp: current_time,
            });
        }
        
        Ok(())
    }
    
    // Helper functions would be implemented in the same module
}

/// Helper function to check and process milestones
fn check_and_process_milestone(
    accounts: &UpdateTimeMultiplier,
    current_time: i64,
) -> Result<()> {
    let stake_info = &mut accounts.stake_info;
    let pool_state = &accounts.pool_state;
    
    // Calculate days staked
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
        let bit_mask = 1u8 << bit_pos;
        
        // If days staked exceeds milestone days and milestone not yet achieved
        if days_staked >= *days as i64 && (stake_info.milestones_achieved & bit_mask) == 0 {
            // Mark milestone as achieved
            stake_info.milestones_achieved |= bit_mask;
            
            // Calculate milestone bonus (percentage of base rewards)
            let bonus_percent = match bit_pos {
                0 => 5,    // 5% bonus for 30-day milestone
                1 => 10,   // 10% bonus for 90-day milestone
                2 => 15,   // 15% bonus for 180-day milestone
                3 => 25,   // 25% bonus for 365-day milestone
                _ => 0,
            };
            
            // Calculate tier multiplier
            let tier_multiplier = match stake_info.tier {
                0 => pool_state.common_multiplier,    // Common
                1 => pool_state.rare_multiplier,      // Rare
                2 => pool_state.epic_multiplier,      // Epic
                3 => pool_state.legendary_multiplier, // Legendary
                _ => pool_state.common_multiplier,    // Default to Common
            };
            
            // Calculate base daily reward
            let base_daily_reward = pool_state.reward_rate
                .checked_mul(tier_multiplier)
                .ok_or(StakingError::ArithmeticError)?
                .checked_div(100)
                .ok_or(StakingError::ArithmeticError)?;
                
            // Calculate milestone reward (30 days worth of % bonus)
            let milestone_reward = base_daily_reward
                .checked_mul(bonus_percent)
                .ok_or(StakingError::ArithmeticError)?
                .checked_div(100)
                .ok_or(StakingError::ArithmeticError)?
                .checked_mul(30) // 30 days worth
                .ok_or(StakingError::ArithmeticError)?;
                
            // Apply milestone reward to accumulated compound if auto-compound is enabled
            if stake_info.auto_compound {
                stake_info.accumulated_compound = stake_info.accumulated_compound
                    .checked_add(milestone_reward)
                    .ok_or(StakingError::ArithmeticError)?;
            }
            
            // Set next milestone
            let next_milestones: Vec<u64> = milestones.iter()
                .filter(|&&(milestone_days, pos)| milestone_days as i64 > days_staked && (stake_info.milestones_achieved & (1 << pos)) == 0)
                .map(|&(days, _)| days)
                .collect();
                
            stake_info.next_milestone_days = next_milestones.first().copied().unwrap_or(0);
            
            // Emit milestone event
            emit!(MilestoneAchieved {
                user: accounts.owner.key(),
                nft_mint: accounts.nft_mint.key(),
                milestone_type: *bit_pos as u8,
                reward_amount: milestone_reward,
                timestamp: current_time,
            });
        }
    }
    
    Ok(())
}

/// Helper function to update collection bonus
fn update_collection_bonus(
    user_staking_info: &mut UserStakingInfo,
    pool_state: &PoolState,
) -> Result<bool> {
    let staked_count = user_staking_info.staked_count;
    
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

/// Calculate rewards for a staked NFT
fn calculate_rewards(
    stake_info: &StakeInfo,
    pool_state: &PoolState,
    current_time: i64,
) -> Result<u64> {
    // Get time elapsed since last claim
    let time_elapsed = current_time.checked_sub(stake_info.last_claim_time)
        .ok_or(StakingError::ArithmeticError)?;
        
    // If no time has passed, return 0
    if time_elapsed <= 0 {
        return Ok(0);
    }
    
    // Calculate elapsed days (integer division)
    let elapsed_days = time_elapsed / 86400;
    
    // Apply fractional day
    let fractional_day = (time_elapsed % 86400) as f64 / 86400.0;
    
    // Get tier multiplier
    let tier_multiplier = match stake_info.tier {
        0 => pool_state.common_multiplier,    // Common
        1 => pool_state.rare_multiplier,      // Rare
        2 => pool_state.epic_multiplier,      // Epic
        3 => pool_state.legendary_multiplier, // Legendary
        _ => pool_state.common_multiplier,    // Default to Common
    };
    
    // Calculate base daily reward
    let base_daily_reward = pool_state.reward_rate
        .checked_mul(tier_multiplier)
        .ok_or(StakingError::ArithmeticError)?
        .checked_div(100)
        .ok_or(StakingError::ArithmeticError)?;
        
    // Apply time-based multiplier
    let with_time_multiplier = base_daily_reward
        .checked_mul(10000 + stake_info.current_time_multiplier)
        .ok_or(StakingError::ArithmeticError)?
        .checked_div(10000)
        .ok_or(StakingError::ArithmeticError)?;
        
    // Apply compound streak multiplier
    let with_compound_multiplier = with_time_multiplier
        .checked_mul(10000 + stake_info.compound_streak_multiplier)
        .ok_or(StakingError::ArithmeticError)?
        .checked_div(10000)
        .ok_or(StakingError::ArithmeticError)?;
        
    // Calculate reward for full days
    let full_days_reward = with_compound_multiplier
        .checked_mul(elapsed_days as u64)
        .ok_or(StakingError::ArithmeticError)?;
        
    // Calculate reward for fractional day
    let fractional_reward = (with_compound_multiplier as f64 * fractional_day) as u64;
    
    // Total reward
    let total_reward = full_days_reward
        .checked_add(fractional_reward)
        .ok_or(StakingError::ArithmeticError)?;
        
    Ok(total_reward)
}

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

#[derive(Accounts)]
pub struct ProcessAutoCompound<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"stake", nft_mint.key().as_ref()],
        bump,
        constraint = stake_info.owner == owner.key() @ StakingError::NotOwner,
        constraint = stake_info.is_staked == true @ StakingError::NotStaked,
        constraint = stake_info.auto_compound == true @ StakingError::AutoCompoundNotEnabled,
    )]
    pub stake_info: Account<'info, StakeInfo>,
    
    pub pool_state: Account<'info, PoolState>,
}

#[derive(Accounts)]
pub struct SetCompoundFrequency<'info> {
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
}

#[derive(Accounts)]
pub struct EmergencyUnstakeNft<'info> {
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
    
    #[account(
        mut,
        seeds = [b"user_staking", owner.key().as_ref()],
        bump,
    )]
    pub user_staking_info: Account<'info, UserStakingInfo>,
    
    pub pool_state: Account<'info, PoolState>,
    
    // Additional accounts needed for token transfers
    // would be added here (similar to unstake_nft)
}

/// Extended stake info account with new fields
#[account]
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
    
    // New fields for enhanced staking
    pub current_time_multiplier: u64,     // Time-based multiplier in basis points (100 = 1%)
    pub last_multiplier_update: i64,      // Last time the multiplier was updated
    pub milestones_achieved: u8,          // Bitmap of achieved milestones
    pub next_milestone_days: u64,         // Days until next milestone
    pub compound_frequency: u8,           // 0=daily, 1=weekly, 2=monthly, 255=manual
    pub compound_streak: u16,             // Consecutive successful compounds
    pub compound_streak_multiplier: u64,  // Bonus from compound streak in basis points
}

/// Extended pool state account with new fields
#[account]
pub struct PoolState {
    pub admin: Pubkey,
    pub reward_rate: u64,
    pub emergency_fee_percent: u8,
    pub paused: bool,
    pub total_staked: u64,
    pub common_multiplier: u64,
    pub rare_multiplier: u64,
    pub epic_multiplier: u64,
    pub legendary_multiplier: u64,
    pub long_staking_bonus: u64,
    pub max_nfts_per_user: u8,
    
    // New fields for enhanced staking
    pub time_multiplier_increment: u64,    // Increase per period in basis points (500 = 5%)
    pub time_multiplier_period_days: u64,  // Period length in days (e.g., 30)
    pub max_time_multiplier: u64,          // Maximum time multiplier in basis points (5000 = 50%)
}

/// Extended user staking info account with collection bonus
#[account]
pub struct UserStakingInfo {
    pub owner: Pubkey,
    pub staked_count: u8,
    pub staked_mints: Vec<Pubkey>,
    
    // New field for collection bonus
    pub collection_bonus: u64, // In basis points (500 = 5%)
}

/// Custom events for enhanced staking features
#[event]
pub struct MultiplierUpdated {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub old_multiplier: u64,
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
pub struct CompoundStreakIncreased {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub new_streak: u16,
    pub new_multiplier: u64,
    pub timestamp: i64,
}

#[event]
pub struct CompoundFrequencyChanged {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub old_frequency: u8,
    pub new_frequency: u8,
    pub timestamp: i64,
}

#[event]
pub struct CollectionBonusUpdated {
    pub user: Pubkey,
    pub staked_count: u8,
    pub new_bonus: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmergencyUnstaked {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub earned_rewards: u64,
    pub penalty_amount: u64,
    pub final_rewards: u64,
    pub progress_percentage: u8,
    pub timestamp: i64,
}

/// Error codes for staking program
#[error_code]
pub enum StakingError {
    #[msg("NFT is not staked")]
    NotStaked,
    
    #[msg("Not the NFT owner")]
    NotOwner,
    
    #[msg("Not the pool admin")]
    NotAdmin,
    
    #[msg("Pool is currently paused")]
    PoolPaused,
    
    #[msg("Staking period not completed yet")]
    StakingPeriodNotCompleted,
    
    #[msg("Invalid NFT tier")]
    InvalidNftTier,
    
    #[msg("Invalid staking period")]
    InvalidStakingPeriod,
    
    #[msg("Maximum NFTs per user exceeded")]
    MaxNftsExceeded,
    
    #[msg("Arithmetic error")]
    ArithmeticError,
    
    #[msg("Invalid compound frequency")]
    InvalidCompoundFrequency,
    
    #[msg("Compound operation too early")]
    CompoundTooEarly,
    
    #[msg("Auto-compound not enabled")]
    AutoCompoundNotEnabled,
    
    #[msg("Invalid milestone")]
    InvalidMilestone,
}