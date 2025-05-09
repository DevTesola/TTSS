/**
 * TESOLA NFT 스테이킹 - 직접 RPC 호출을 통한 마이그레이션 스크립트 (최종 버전)
 */
const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// 프로그램 ID
const PROGRAM_ID = new PublicKey('4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs');

// 프로그램의 discriminator 접두사 (각 명령어에 고유한 8바이트 값)
const DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  updatePoolSettings: Buffer.from([222, 34, 66, 86, 117, 205, 101, 49]),
  initializeRewardPool: Buffer.from([139, 189, 60, 130, 44, 211, 218, 99]),
  updateRewardParams: Buffer.from([146, 73, 176, 37, 49, 138, 89, 174]),
  migrateStakeInfo: Buffer.from([55, 216, 65, 105, 113, 167, 92, 110]),
  migrateUserStakingInfo: Buffer.from([109, 210, 28, 22, 40, 37, 154, 145]),
  fundRewardPool: Buffer.from([85, 49, 108, 245, 204, 70, 243, 3])
};

// Solana 연결
const connection = new Connection(
  process.env.NETWORK_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// 지갑 설정
const loadWallet = () => {
  const keypairFile = process.env.KEYPAIR_PATH || path.resolve(__dirname, '../solana-projects/nft_staking_fixed/my-wallet.json');
  console.log(`Loading wallet from: ${keypairFile}`);
  const keypairData = fs.readFileSync(keypairFile);
  return Keypair.fromSecretKey(Buffer.from(JSON.parse(keypairData)));
};

// PDA 주소 찾기
const findProgramAddress = async (seeds, programId) => {
  return await PublicKey.findProgramAddress(seeds, programId);
};

// 대기 유틸리티 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// BN을 Uint8Array로 변환
const u64ToLEBytes = (value) => {
  const bn = BigInt(value);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(bn);
  return buffer;
};

// u8을 Uint8Array로 변환
const u8ToBytes = (value) => {
  return Buffer.from([value]);
};

// i64를 Uint8Array로 변환
const i64ToLEBytes = (value) => {
  return u64ToLEBytes(value); // JS에서는 i64와 u64가 같은 방식으로 표현됨
};

// 옵션 타입 인코딩 (Option<u64>)
const encodeOption = (value) => {
  if (value === null) {
    return Buffer.from([0]); // None
  }
  return Buffer.concat([
    Buffer.from([1]), // Some
    u64ToLEBytes(value)
  ]);
};

/**
 * 풀 초기화 함수
 */
async function initializePool(walletKeypair) {
  console.log('Initializing pool...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], PROGRAM_ID);
    
    // 풀 상태 계정이 이미 있는지 확인
    try {
      const poolStateAccount = await connection.getAccountInfo(poolStatePDA);
      if (poolStateAccount) {
        console.log('Pool state already exists, skipping initialization');
        return { success: true, alreadyInitialized: true };
      }
    } catch (err) {
      console.log('Could not fetch pool state account, proceeding with initialization');
    }
    
    // 명령어 데이터 직렬화 - rewardRate: 100, emergencyFee: 5 (5%)
    const data = Buffer.concat([
      DISCRIMINATORS.initialize,
      u64ToLEBytes(100),  // reward_rate
      u8ToBytes(5)        // emergency_fee
    ]);
    
    // 트랜잭션 인스트럭션 생성
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: poolStatePDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: PROGRAM_ID,
      data
    });
    
    // 트랜잭션 생성 및 실행
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair]
    );
    
    console.log(`✅ Pool initialized: ${signature}`);
    return { success: true, signature };
  } catch (error) {
    console.error('❌ Error initializing pool:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 사용자당 최대 NFT 개수를 3개로 업데이트
 */
async function updateMaxNftsPerUser(walletKeypair) {
  console.log('Updating max NFTs per user to 3...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], PROGRAM_ID);
    
    // 명령어 데이터 직렬화
    const data = Buffer.concat([
      DISCRIMINATORS.updatePoolSettings,
      Buffer.from([1]), // Option<u8>::Some
      Buffer.from([3]), // max_nfts_per_user = 3
      Buffer.from([0]), // Option<u64>::None for longStakingBonus
      Buffer.from([0])  // Option<u8>::None for emergencyFee
    ]);
    
    // 트랜잭션 인스트럭션 생성
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: poolStatePDA, isSigner: false, isWritable: true }
      ],
      programId: PROGRAM_ID,
      data
    });
    
    // 트랜잭션 생성 및 실행
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair]
    );
    
    console.log(`✅ Max NFTs per user updated to 3: ${signature}`);
    return { success: true, signature };
  } catch (error) {
    console.error('❌ Error updating max NFTs per user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 리워드 풀 초기화 함수 (개선된 버전)
 */
async function initializeRewardPool(walletKeypair, rewardMint) {
  console.log('Initializing reward pool...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], PROGRAM_ID);
    const [rewardVaultAuthority] = await findProgramAddress(
      [Buffer.from('reward_vault_authority')],
      PROGRAM_ID
    );
    
    // 새 토큰 계정 생성 대신 관리자의 ATA를 vault로 임시 사용
    // 실제 구현에서는 고유한 vault 계정을 만들어야 하지만, 테스트를 위해 단순화
    const adminTokenAccount = await getAssociatedTokenAddress(
      rewardMint,
      walletKeypair.publicKey
    );
    
    // 명령어 데이터 직렬화
    const data = Buffer.concat([DISCRIMINATORS.initializeRewardPool]);
    
    // 트랜잭션 인스트럭션 생성
    // 중요: rewardVault에 관리자의 ATA를 사용
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: poolStatePDA, isSigner: false, isWritable: true },
        { pubkey: rewardMint, isSigner: false, isWritable: false },
        { pubkey: adminTokenAccount, isSigner: false, isWritable: true },
        { pubkey: rewardVaultAuthority, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: PROGRAM_ID,
      data
    });
    
    // ATA가 존재하는지 확인
    const tokenAccountInfo = await connection.getAccountInfo(adminTokenAccount);
    
    // ATA가 없으면 생성하는 명령 추가
    let transaction = new Transaction();
    if (!tokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletKeypair.publicKey,
          adminTokenAccount,
          walletKeypair.publicKey,
          rewardMint
        )
      );
    }
    
    // 리워드 풀 초기화 명령 추가
    transaction.add(instruction);
    
    // 트랜잭션 실행
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair]
    );
    
    console.log(`✅ Reward pool initialized (using admin token account): ${signature}`);
    return { success: true, signature };
  } catch (error) {
    console.error('❌ Error initializing reward pool:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 보상 파라미터 업데이트
 */
async function updateRewardParams(walletKeypair, params) {
  console.log('Updating reward parameters...');
  
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], PROGRAM_ID);
    
    // 명령어 데이터 직렬화
    const data = Buffer.concat([
      DISCRIMINATORS.updateRewardParams,
      encodeOption(params.timeMultiplierIncrement || null),
      encodeOption(params.timeMultiplierPeriodDays || null),
      encodeOption(params.maxTimeMultiplier || null)
    ]);
    
    // 트랜잭션 인스트럭션 생성
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: poolStatePDA, isSigner: false, isWritable: true }
      ],
      programId: PROGRAM_ID,
      data
    });
    
    // 트랜잭션 생성 및 실행
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair]
    );
    
    console.log(`✅ Reward parameters updated: ${signature}`);
    return { success: true, signature };
  } catch (error) {
    console.error('❌ Error updating reward parameters:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 전체 마이그레이션 실행
 */
async function runMigration() {
  try {
    // 지갑 로드
    const walletKeypair = loadWallet();
    console.log(`Using wallet: ${walletKeypair.publicKey.toString()}`);
    
    // 사용할 리워드 토큰 민트 주소 (SOL 사용)
    const rewardMint = new PublicKey(process.env.REWARD_TOKEN_MINT || 'So11111111111111111111111111111111111111112');
    
    // 1. 풀 초기화 (모든 작업의 선행 조건)
    const initResult = await initializePool(walletKeypair);
    if (!initResult.success && !initResult.alreadyInitialized) {
      console.warn(`Warning: Failed to initialize pool: ${initResult.error}`);
      // 풀 초기화 실패는 심각한 오류이므로 여기서 중단
      return false;
    }
    
    // 대기
    await sleep(2000);
    
    // 2. 사용자당 최대 NFT 개수 업데이트
    const updateMaxResult = await updateMaxNftsPerUser(walletKeypair);
    if (!updateMaxResult.success) {
      console.warn(`Warning: Failed to update max NFTs per user: ${updateMaxResult.error}`);
    }
    
    // 대기
    await sleep(2000);
    
    // 3. 보상 파라미터 설정
    const updateParamsResult = await updateRewardParams(walletKeypair, {
      timeMultiplierIncrement: 500, // 30일마다 5% 증가
      timeMultiplierPeriodDays: 30, // 30일 단위로 증가
      maxTimeMultiplier: 5000 // 최대 50% 시간 기반 승수
    });
    if (!updateParamsResult.success) {
      console.warn(`Warning: Failed to update reward parameters: ${updateParamsResult.error}`);
    }
    
    // 대기
    await sleep(2000);
    
    // 4. 리워드 풀 초기화 (선택적 실행)
    if (process.env.INITIALIZE_REWARD_POOL === "true") {
      const initPoolResult = await initializeRewardPool(walletKeypair, rewardMint);
      if (!initPoolResult.success) {
        console.warn(`Warning: Failed to initialize reward pool: ${initPoolResult.error}`);
      }
    } else {
      console.log("Skipping reward pool initialization (set INITIALIZE_REWARD_POOL=true to enable)");
    }
    
    console.log('Migration completed successfully!');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

/**
 * 풀 상태 조회
 */
async function checkPoolState() {
  try {
    // PDA 주소 찾기
    const [poolStatePDA] = await findProgramAddress([Buffer.from('pool_state')], PROGRAM_ID);
    
    // 계정 정보 가져오기
    const accountInfo = await connection.getAccountInfo(poolStatePDA);
    
    if (!accountInfo) {
      console.log("Pool state account not found");
      return { exists: false };
    }
    
    console.log(`Pool state account exists (${accountInfo.data.length} bytes)`);
    
    // 더 자세한 정보는 클라이언트 라이브러리로 디코딩 필요
    return { 
      exists: true, 
      data: {
        size: accountInfo.data.length,
        lamports: accountInfo.lamports,
        executable: accountInfo.executable,
        owner: accountInfo.owner.toString()
      }
    };
  } catch (error) {
    console.error('Error checking pool state:', error);
    return { exists: false, error: error.message };
  }
}

// 마이그레이션 실행
if (require.main === module) {
  // 명령행 인자 확인
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0] === "check") {
    // 풀 상태 확인만 실행
    checkPoolState().then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }).catch(err => {
      console.error('Error checking pool state:', err);
      process.exit(1);
    });
  } else {
    // 전체 마이그레이션 실행
    runMigration().then(success => {
      if (success) {
        console.log('Migration script completed successfully');
      } else {
        console.error('Migration script failed');
      }
      process.exit(success ? 0 : 1);
    }).catch(err => {
      console.error('Migration script error:', err);
      process.exit(1);
    });
  }
}

module.exports = {
  runMigration,
  initializePool,
  updateMaxNftsPerUser,
  initializeRewardPool,
  updateRewardParams,
  checkPoolState
};