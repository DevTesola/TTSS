/**
 * IDL 파일 추출 및 변환 스크립트
 */
const fs = require('fs');
const path = require('path');

// 원본 IDL 파일 경로
const originalIdlPath = '/home/tesola/solana-projects/nft_staking_fixed/target/idl/nft_staking_fixed.json';

// 변환된 IDL 파일 저장 경로
const convertedIdlPath = '/home/tesola/ttss/tesolafixjs/converted_idl.json';

/**
 * IDL 파일을 변환하는 함수
 */
function convertIdl() {
  try {
    console.log(`Reading IDL from: ${originalIdlPath}`);
    const originalIdl = JSON.parse(fs.readFileSync(originalIdlPath, 'utf8'));
    
    // 변환된 IDL 객체 생성
    const convertedIdl = {
      version: "0.1.0",
      name: "nft_staking_fixed",
      instructions: [],
      accounts: [],
      errors: []
    };
    
    // 필요한 인스트럭션만 추출
    const neededInstructions = [
      "initialize", "initializeRewardPool", "updateRewardParams", 
      "fundRewardPool", "updatePoolSettings", "migrateStakeInfo", 
      "migrateUserStakingInfo"
    ];
    
    // 인스트럭션 복사
    for (const instr of originalIdl.instructions) {
      if (neededInstructions.includes(instr.name)) {
        // 필요한 필드만 추출
        const convertedInstr = {
          name: instr.name,
          accounts: instr.accounts.map(acc => ({
            name: acc.name,
            isMut: acc.isMut || false,
            isSigner: acc.isSigner || false
          })),
          args: instr.args || []
        };
        
        convertedIdl.instructions.push(convertedInstr);
      }
    }
    
    // 계정 정의 추가
    convertedIdl.accounts = [
      {
        name: "poolState",
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
        name: "stakeInfo",
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
        name: "userStakingInfo",
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
    ];
    
    // 기본 에러 추가
    convertedIdl.errors = [
      { code: 6000, name: "NotStaked", msg: "NFT is not staked" },
      { code: 6001, name: "NotOwner", msg: "Not the NFT owner" },
      { code: 6002, name: "NotAdmin", msg: "Not the pool admin" },
      { code: 6003, name: "PoolPaused", msg: "Pool is currently paused" },
      { code: 6004, name: "StakingPeriodNotCompleted", msg: "Staking period not completed yet" },
      { code: 6005, name: "InvalidNftTier", msg: "Invalid NFT tier" },
      { code: 6006, name: "InvalidStakingPeriod", msg: "Invalid staking period" },
      { code: 6007, name: "MaxNftsExceeded", msg: "Maximum NFTs per user exceeded" },
      { code: 6008, name: "InvalidMint", msg: "Invalid token mint" },
      { code: 6009, name: "InvalidVault", msg: "Invalid reward vault" },
      { code: 6010, name: "InsufficientRewardBalance", msg: "Insufficient reward balance" }
    ];
    
    // 변환된 IDL 파일 저장
    fs.writeFileSync(convertedIdlPath, JSON.stringify(convertedIdl, null, 2));
    console.log(`Converted IDL saved to: ${convertedIdlPath}`);
    
    return convertedIdl;
    
  } catch (error) {
    console.error('Error converting IDL:', error);
    
    // 오류 발생 시 하드코딩된 IDL 반환
    return getHardcodedIdl();
  }
}

/**
 * 하드코딩된 IDL 반환 함수
 */
function getHardcodedIdl() {
  console.log('Using hardcoded IDL');
  
  return {
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
        name: "poolState",
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
        name: "stakeInfo",
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
        name: "userStakingInfo",
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
    ],
    errors: [
      { code: 6000, name: "NotStaked", msg: "NFT is not staked" },
      { code: 6001, name: "NotOwner", msg: "Not the NFT owner" },
      { code: 6002, name: "NotAdmin", msg: "Not the pool admin" },
      { code: 6003, name: "PoolPaused", msg: "Pool is currently paused" },
      { code: 6004, name: "StakingPeriodNotCompleted", msg: "Staking period not completed yet" },
      { code: 6005, name: "InvalidNftTier", msg: "Invalid NFT tier" },
      { code: 6006, name: "InvalidStakingPeriod", msg: "Invalid staking period" },
      { code: 6007, name: "MaxNftsExceeded", msg: "Maximum NFTs per user exceeded" },
      { code: 6008, name: "InvalidMint", msg: "Invalid token mint" },
      { code: 6009, name: "InvalidVault", msg: "Invalid reward vault" },
      { code: 6010, name: "InsufficientRewardBalance", msg: "Insufficient reward balance" }
    ]
  };
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
  const idl = convertIdl();
  console.log('IDL conversion complete');
}

module.exports = {
  convertIdl,
  getHardcodedIdl
};