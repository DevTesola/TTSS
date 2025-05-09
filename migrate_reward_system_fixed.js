/**
 * TESOLA NFT 스테이킹 - 보상 시스템 마이그레이션 스크립트 (수정본)
 * 기존 계정들을 새로운 구조로 마이그레이션
 */
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { Program, AnchorProvider, BN, web3 } = require('@coral-xyz/anchor');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// 프로그램 ID
const PROGRAM_ID = new PublicKey('4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs');

// 지갑 설정
const loadWallet = () => {
  const keypairFile = process.env.KEYPAIR_PATH || path.resolve(__dirname, '../solana-projects/nft_staking_fixed/my-wallet.json');
  const keypairData = fs.readFileSync(keypairFile);
  return Keypair.fromSecretKey(Buffer.from(JSON.parse(keypairData)));
};

// Solana 연결 설정
const getProvider = (walletKeypair) => {
  // 연결할 네트워크 (devnet 또는 mainnet-beta)
  const endpoint = process.env.NETWORK_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(endpoint, 'confirmed');
  
  // 월렛 어댑터 설정
  const wallet = {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(walletKeypair);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map(tx => {
        tx.partialSign(walletKeypair);
        return tx;
      });
    },
  };
  
  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
};

// PDA 주소 찾기 유틸리티 함수
const findProgramAddress = async (seeds, programId) => {
  return await PublicKey.findProgramAddress(seeds, programId);
};

// 대기 유틸리티 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// IDL 하드코딩 (JSON 직접 로드 대신 IDL 명시적 정의)
function loadModifiedIdl() {
  // 완전히 하드코딩된 IDL 사용
  const idl = {
    version: "0.1.0",
    name: "nft_staking_fixed",
    instructions: [
      {
        name: "initialize",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "poolState", isMut: true, isSigner: false },
          { name: "systemProgram", isMut: false, isSigner: false }
        ],
        args: [
          { name: "rewardRate", type: "u64" },
          { name: "emergencyFee", type: "u8" }
        ]
      },
      {
        name: "initializeRewardPool",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "poolState", isMut: true, isSigner: false },
          { name: "rewardMint", isMut: false, isSigner: false },
          { name: "rewardVault", isMut: true, isSigner: true },
          { name: "rewardVaultAuthority", isMut: false, isSigner: false },
          { name: "systemProgram", isMut: false, isSigner: false },
          { name: "tokenProgram", isMut: false, isSigner: false },
          { name: "rent", isMut: false, isSigner: false }
        ],
        args: []
      },
      {
        name: "updateRewardParams",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "poolState", isMut: true, isSigner: false }
        ],
        args: [
          { name: "timeMultiplierIncrement", type: { option: "u64" } },
          { name: "timeMultiplierPeriodDays", type: { option: "u64" } },
          { name: "maxTimeMultiplier", type: { option: "u64" } }
        ]
      },
      {
        name: "fundRewardPool",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "poolState", isMut: true, isSigner: false },
          { name: "rewardVault", isMut: true, isSigner: false },
          { name: "funderTokenAccount", isMut: true, isSigner: false },
          { name: "tokenProgram", isMut: false, isSigner: false }
        ],
        args: [
          { name: "amount", type: "u64" }
        ]
      },
      {
        name: "updatePoolSettings",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "poolState", isMut: true, isSigner: false }
        ],
        args: [
          { name: "maxNftsPerUser", type: { option: "u8" } },
          { name: "longStakingBonus", type: { option: "u64" } },
          { name: "emergencyFee", type: { option: "u8" } }
        ]
      },
      {
        name: "migrateStakeInfo",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "stakeInfo", isMut: true, isSigner: false }
        ],
        args: [
          { name: "timeMultiplier", type: "u64" },
          { name: "lastMultiplierUpdate", type: "i64" },
          { name: "milestonesAchieved", type: "u8" },
          { name: "nextMilestoneDays", type: "u64" }
        ]
      },
      {
        name: "migrateUserStakingInfo",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "userStakingInfo", isMut: true, isSigner: false }
        ],
        args: [
          { name: "collectionBonus", type: "u64" }
        ]
      }
    ],
    accounts: [
      {
        name: "PoolState",
        type: {
          kind: "struct",
          fields: [
            { name: "admin", type: "pubkey" },
            { name: "rewardRate", type: "u64" },
            { name: "emergencyFeePercent", type: "u8" },
            { name: "paused", type: "bool" },
            { name: "totalStaked", type: "u64" },
            { name: "commonMultiplier", type: "u64" },
            { name: "rareMultiplier", type: "u64" },
            { name: "epicMultiplier", type: "u64" },
            { name: "legendaryMultiplier", type: "u64" },
            { name: "longStakingBonus", type: "u64" },
            { name: "maxNftsPerUser", type: "u8" },
            { name: "timeMultiplierIncrement", type: "u64" },
            { name: "timeMultiplierPeriodDays", type: "u64" },
            { name: "maxTimeMultiplier", type: "u64" },
            { name: "rewardMint", type: "pubkey" },
            { name: "rewardVault", type: "pubkey" },
            { name: "rewardsDistributed", type: "u64" }
          ]
        }
      },
      {
        name: "StakeInfo",
        type: {
          kind: "struct",
          fields: [
            { name: "owner", type: "pubkey" },
            { name: "mint", type: "pubkey" },
            { name: "stakedAt", type: "i64" },
            { name: "releaseDate", type: "i64" },
            { name: "isStaked", type: "bool" },
            { name: "tier", type: "u8" },
            { name: "lastClaimTime", type: "i64" },
            { name: "stakingPeriod", type: "u64" },
            { name: "autoCompound", type: "bool" },
            { name: "accumulatedCompound", type: "u64" },
            { name: "currentTimeMultiplier", type: "u64" },
            { name: "lastMultiplierUpdate", type: "i64" },
            { name: "milestonesAchieved", type: "u8" },
            { name: "nextMilestoneDays", type: "u64" }
          ]
        }
      },
      {
        name: "UserStakingInfo",
        type: {
          kind: "struct",
          fields: [
            { name: "owner", type: "pubkey" },
            { name: "stakedCount", type: "u8" },
            { name: "stakedMints", type: { vec: "pubkey" } },
            { name: "collectionBonus", type: "u64" }
          ]
        }
      }
    {
      name: "PoolState",
      type: {
        kind: "struct",
        fields: [
          { name: "admin", type: "pubkey" },
          { name: "reward_rate", type: "u64" },
          { name: "emergency_fee_percent", type: "u8" },
          { name: "paused", type: "bool" },
          { name: "total_staked", type: "u64" },
          { name: "common_multiplier", type: "u64" },
          { name: "rare_multiplier", type: "u64" },
          { name: "epic_multiplier", type: "u64" },
          { name: "legendary_multiplier", type: "u64" },
          { name: "long_staking_bonus", type: "u64" },
          { name: "max_nfts_per_user", type: "u8" },
          { name: "time_multiplier_increment", type: "u64" },
          { name: "time_multiplier_period_days", type: "u64" },
          { name: "max_time_multiplier", type: "u64" },
          { name: "reward_mint", type: "pubkey" },
          { name: "reward_vault", type: "pubkey" },
          { name: "rewards_distributed", type: "u64" }
        ]
      }
    },
    {
      name: "StakeInfo",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "staked_at", type: "i64" },
          { name: "release_date", type: "i64" },
          { name: "is_staked", type: "bool" },
          { name: "tier", type: "u8" },
          { name: "last_claim_time", type: "i64" },
          { name: "staking_period", type: "u64" },
          { name: "auto_compound", type: "bool" },
          { name: "accumulated_compound", type: "u64" },
          { name: "current_time_multiplier", type: "u64" },
          { name: "last_multiplier_update", type: "i64" },
          { name: "milestones_achieved", type: "u8" },
          { name: "next_milestone_days", type: "u64" }
        ]
      }
    },
    {
      name: "UserStakingInfo",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "staked_count", type: "u8" },
          { name: "staked_mints", type: { "vec": "pubkey" } },
          { name: "collection_bonus", type: "u64" }
        ]
      }
    }
  ];
  
  return idl;
}

/**
 * 리워드 풀 초기화 함수
 */
async function initializeRewardPool(program, walletKeypair, rewardMint) {
  console.log('Initializing reward pool...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], program.programId);
    const [rewardVaultAuthority] = await findProgramAddress([Buffer.from('reward_vault_authority')], program.programId);
    
    // 풀 계정 가져오기
    try {
      const poolState = await program.account.poolState.fetch(poolStatePDA);
      console.log("Pool state already exists:", poolState);
    } catch (err) {
      console.log("Pool state doesn't exist yet or cannot be fetched");
    }
    
    // 보상 토큰용 vault 계정 주소 찾기
    const [rewardVaultPDA] = await findProgramAddress(
      [Buffer.from('reward_vault'), rewardMint.toBuffer()],
      program.programId
    );
    
    // 리워드 풀 초기화 트랜잭션 실행
    const tx = await program.methods
      .initializeRewardPool()
      .accounts({
        admin: walletKeypair.publicKey,
        poolState: poolStatePDA,
        rewardMint: rewardMint,
        rewardVault: rewardVaultPDA,
        rewardVaultAuthority: rewardVaultAuthority,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    console.log(`✅ Reward pool initialized: ${tx}`);
    return { success: true, signature: tx };
  } catch (error) {
    console.error('❌ Error initializing reward pool:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 보상 파라미터 업데이트 함수
 */
async function updateRewardParams(program, walletKeypair, params) {
  console.log('Updating reward parameters...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], program.programId);
    
    // 파라미터 업데이트 트랜잭션 실행
    const tx = await program.methods
      .updateRewardParams(
        params.timeMultiplierIncrement ? new BN(params.timeMultiplierIncrement) : null,
        params.timeMultiplierPeriodDays ? new BN(params.timeMultiplierPeriodDays) : null,
        params.maxTimeMultiplier ? new BN(params.maxTimeMultiplier) : null
      )
      .accounts({
        admin: walletKeypair.publicKey,
        poolState: poolStatePDA,
      })
      .rpc();
    
    console.log(`✅ Reward parameters updated: ${tx}`);
    return { success: true, signature: tx };
  } catch (error) {
    console.error('❌ Error updating reward parameters:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 리워드 풀 충전 함수
 */
async function fundRewardPool(program, walletKeypair, rewardMint, amount) {
  console.log(`Funding reward pool with ${amount} tokens...`);
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], program.programId);
    
    // 풀 계정 가져오기
    const poolState = await program.account.poolState.fetch(poolStatePDA);
    
    // 보상 토큰 계정 주소
    const rewardVault = new PublicKey(poolState.rewardVault);
    
    // 관리자의 토큰 계정 주소 가져오기
    const adminTokenAccount = await getAssociatedTokenAddress(
      rewardMint,
      walletKeypair.publicKey
    );
    
    // 리워드 풀 충전 트랜잭션 실행
    const tx = await program.methods
      .fundRewardPool(new BN(amount))
      .accounts({
        admin: walletKeypair.publicKey,
        poolState: poolStatePDA,
        rewardVault: rewardVault,
        funderTokenAccount: adminTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log(`✅ Reward pool funded with ${amount} tokens: ${tx}`);
    return { success: true, signature: tx };
  } catch (error) {
    console.error('❌ Error funding reward pool:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 모든 StakeInfo 계정 가져오기
 */
async function getAllStakeInfoAccounts(program) {
  console.log('Fetching all StakeInfo accounts...');
  const accounts = await program.account.stakeInfo.all();
  console.log(`Found ${accounts.length} StakeInfo accounts`);
  return accounts;
}

/**
 * 모든 UserStakingInfo 계정 가져오기
 */
async function getAllUserStakingInfoAccounts(program) {
  console.log('Fetching all UserStakingInfo accounts...');
  const accounts = await program.account.userStakingInfo.all();
  console.log(`Found ${accounts.length} UserStakingInfo accounts`);
  return accounts;
}

/**
 * 사용자당 최대 NFT 개수를 3개로 업데이트
 */
async function updateMaxNftsPerUser(program, walletKeypair) {
  console.log('Updating max NFTs per user to 3...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], program.programId);
    
    // 풀 계정 가져오기
    const poolState = await program.account.poolState.fetch(poolStatePDA);
    
    // 현재 값 확인
    console.log(`Current max NFTs per user: ${poolState.maxNftsPerUser}`);
    
    // 이미 3으로 설정되어 있는지 확인
    if (poolState.maxNftsPerUser === 3) {
      console.log('✅ Max NFTs per user is already set to 3');
      return { success: true, alreadySet: true };
    }
    
    // 값 업데이트
    const tx = await program.methods
      .updatePoolSettings(
        3, // max_nfts_per_user = 3
        null, // 다른 설정은 변경하지 않음
        null
      )
      .accounts({
        admin: walletKeypair.publicKey,
        poolState: poolStatePDA,
      })
      .rpc();
    
    console.log(`✅ Max NFTs per user updated to 3: ${tx}`);
    return { success: true, signature: tx };
  } catch (error) {
    console.error('❌ Error updating max NFTs per user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 기존 UserStakingInfo 계정에 컬렉션 보너스 필드 추가
 */
async function migrateUserStakingInfoAccounts(program, walletKeypair) {
  console.log('Migrating UserStakingInfo accounts...');
  
  const accounts = await getAllUserStakingInfoAccounts(program);
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const userAddress = account.account.owner.toString();
    const stakedCount = account.account.stakedCount;
    
    console.log(`Migrating UserStakingInfo for user ${userAddress} (${i+1}/${accounts.length})`);
    
    try {
      // 컬렉션 보너스 계산
      let collectionBonus = 0;
      if (stakedCount >= 3) {
        collectionBonus = 2000; // 20% for 3+ NFTs
      } else if (stakedCount === 2) {
        collectionBonus = 1000; // 10% for 2 NFTs
      }
      
      // 계정 마이그레이션 트랜잭션
      const tx = await program.methods
        .migrateUserStakingInfo(new BN(collectionBonus))
        .accounts({
          admin: walletKeypair.publicKey,
          userStakingInfo: account.publicKey,
        })
        .rpc();
      
      console.log(`  ✅ Successfully migrated: ${tx}`);
      successCount++;
      
      // 속도 제한 방지를 위한 대기
      await sleep(500);
    } catch (error) {
      console.error(`  ❌ Error migrating account: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`Migration completed: ${successCount} succeeded, ${errorCount} failed`);
  return { success: successCount > 0, successCount, errorCount };
}

/**
 * 기존 StakeInfo 계정에 Dynamic Reward Booster 필드 추가
 */
async function migrateStakeInfoAccounts(program, walletKeypair) {
  console.log('Migrating StakeInfo accounts...');
  
  const accounts = await getAllStakeInfoAccounts(program);
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const nftMint = account.account.mint.toString();
    
    // 스테이킹된 계정만 처리
    if (!account.account.isStaked) {
      console.log(`Skipping inactive stake info for NFT ${nftMint}`);
      continue;
    }
    
    console.log(`Migrating StakeInfo for NFT ${nftMint} (${i+1}/${accounts.length})`);
    
    try {
      // 스테이킹 경과 일수 계산
      const stakedAt = account.account.stakedAt.toNumber();
      const currentTime = Math.floor(Date.now() / 1000);
      const daysPassed = Math.floor((currentTime - stakedAt) / 86400);
      
      // 계정 마이그레이션 트랜잭션
      const tx = await program.methods
        .migrateStakeInfo(
          new BN(0), // 초기 time_multiplier = 0
          new BN(currentTime), // last_multiplier_update = 현재 시간
          0, // milestones_achieved = 아직 없음
          new BN(30) // next_milestone_days = 30 (첫 마일스톤)
        )
        .accounts({
          admin: walletKeypair.publicKey,
          stakeInfo: account.publicKey,
        })
        .rpc();
      
      console.log(`  ✅ Successfully migrated: ${tx}`);
      successCount++;
      
      // 속도 제한 방지를 위한 대기
      await sleep(500);
    } catch (error) {
      console.error(`  ❌ Error migrating account: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`Migration completed: ${successCount} succeeded, ${errorCount} failed`);
  return { success: successCount > 0, successCount, errorCount };
}

/**
 * 전체 마이그레이션 프로세스 실행
 */
async function runMigration() {
  try {
    // 설정
    const walletKeypair = loadWallet();
    const provider = getProvider(walletKeypair);
    const idl = loadModifiedIdl(); // 수정된 IDL 로드 함수 호출
    const program = new Program(idl, PROGRAM_ID, provider);
    
    console.log(`Using wallet: ${provider.wallet.publicKey.toString()}`);
    
    // 사용할 리워드 토큰 민트 주소 (실제 값으로 대체 필요)
    const rewardMint = new PublicKey(process.env.REWARD_TOKEN_MINT || 'So11111111111111111111111111111111111111112');
    
    // 1. 사용자당 최대 NFT 개수 업데이트
    await updateMaxNftsPerUser(program, walletKeypair);
    
    // 2. 리워드 풀 초기화
    await initializeRewardPool(program, walletKeypair, rewardMint);
    
    // 3. 보상 파라미터 설정
    await updateRewardParams(program, walletKeypair, {
      timeMultiplierIncrement: 500, // 30일마다 5% 증가
      timeMultiplierPeriodDays: 30, // 30일 단위로 증가
      maxTimeMultiplier: 5000 // 최대 50% 시간 기반 승수
    });
    
    // 4. StakeInfo 계정 마이그레이션
    await migrateStakeInfoAccounts(program, walletKeypair);
    
    // 5. UserStakingInfo 계정 마이그레이션
    await migrateUserStakingInfoAccounts(program, walletKeypair);
    
    // 6. 리워드 풀 충전 (예: 1,000,000 토큰)
    await fundRewardPool(program, walletKeypair, rewardMint, 1_000_000);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// 마이그레이션 실행
if (require.main === module) {
  runMigration().then(() => {
    console.log('Migration script completed');
    process.exit(0);
  }).catch(err => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  initializeRewardPool,
  updateRewardParams,
  fundRewardPool,
  updateMaxNftsPerUser,
  migrateStakeInfoAccounts,
  migrateUserStakingInfoAccounts
};