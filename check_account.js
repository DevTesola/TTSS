/**
 * Solana 계정 정보 확인 스크립트
 */
const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');
const axios = require('axios');

// 프로그램 ID
const PROGRAM_ID = '4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs';

// Solana devnet 연결
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// 읽기 전용 프로바이더
const readOnlyProvider = new AnchorProvider(
  connection,
  { publicKey: PublicKey.default },
  { commitment: 'confirmed' }
);

// Anchor Explorer API에서 IDL 가져오기
async function fetchIdlFromExplorer() {
  try {
    const url = `https://api.anchor.so/v1/program/${PROGRAM_ID}/idl`;
    console.log(`Fetching IDL from: ${url}`);
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch IDL from Anchor Explorer:', error.message);
    return null;
  }
}

// 온체인에서 IDL 가져오기
async function fetchIdlFromChain() {
  try {
    const idl = await Program.fetchIdl(new PublicKey(PROGRAM_ID), readOnlyProvider);
    return idl;
  } catch (error) {
    console.error('Failed to fetch IDL from chain:', error.message);
    return null;
  }
}

// 계정 정보 확인
async function checkAccounts() {
  try {
    console.log(`Checking accounts for program: ${PROGRAM_ID}`);
    
    // IDL 가져오기 (Explorer 또는 온체인)
    let idl = await fetchIdlFromExplorer();
    if (!idl) {
      console.log('Trying to fetch from on-chain IDL account...');
      idl = await fetchIdlFromChain();
    }
    
    if (!idl) {
      console.error('Failed to fetch IDL from any source');
      return;
    }
    
    console.log('IDL found:', JSON.stringify(idl, null, 2));
    
    // 프로그램 인스턴스 생성
    const program = new Program(idl, new PublicKey(PROGRAM_ID), readOnlyProvider);
    
    // 풀 상태 PDA 계산
    const [poolStatePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('pool_state')],
      new PublicKey(PROGRAM_ID)
    );
    
    console.log(`Pool State PDA: ${poolStatePDA.toString()}`);
    
    // 풀 상태 계정 가져오기
    try {
      const poolState = await program.account.poolState.fetch(poolStatePDA);
      console.log('Pool State Account Data:', poolState);
    } catch (error) {
      console.error('Failed to fetch pool state account:', error.message);
    }
    
    // 스테이킹 정보 계정 목록 가져오기
    try {
      const stakeInfoAccounts = await program.account.stakeInfo.all();
      console.log(`Found ${stakeInfoAccounts.length} StakeInfo accounts`);
      
      if (stakeInfoAccounts.length > 0) {
        console.log('First StakeInfo Account Data:', stakeInfoAccounts[0].account);
      }
    } catch (error) {
      console.error('Failed to fetch stake info accounts:', error.message);
    }
    
    // 사용자 스테이킹 정보 계정 목록 가져오기
    try {
      const userStakingInfoAccounts = await program.account.userStakingInfo.all();
      console.log(`Found ${userStakingInfoAccounts.length} UserStakingInfo accounts`);
      
      if (userStakingInfoAccounts.length > 0) {
        console.log('First UserStakingInfo Account Data:', userStakingInfoAccounts[0].account);
      }
    } catch (error) {
      console.error('Failed to fetch user staking info accounts:', error.message);
    }
    
  } catch (error) {
    console.error('Error checking accounts:', error);
  }
}

// 실행
checkAccounts().then(() => {
  console.log('Account check completed');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});