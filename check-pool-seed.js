// check-pool-seed.js
const { Connection, PublicKey } = require('@solana/web3.js');

async function checkPoolState() {
  try {
    const PROGRAM_ID = new PublicKey('4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs');
    
    console.log('Checking pool state with correct seed...');
    
    // 온체인 프로그램은 "pool_state" 시드 사용
    const [poolStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_state")],
      PROGRAM_ID
    );
    
    console.log('Correct Pool state PDA:', poolStatePDA.toString());
    
    // 잘못된 시드("pool")로 생성된 PDA도 확인
    const [wrongPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool")],
      PROGRAM_ID
    );
    
    console.log('Wrong Pool state PDA (using "pool" seed):', wrongPDA.toString());
    
    // 실제 8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP가 무슨 시드로 만들어진 것인지 확인
    const targetPDA = '8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP';
    console.log('Target PDA matches correct seed:', poolStatePDA.toString() === targetPDA);
    console.log('Target PDA matches wrong seed:', wrongPDA.toString() === targetPDA);
    
    // 실제 온체인 연결하여 확인
    const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    
    console.log('\nConnecting to Solana network...');
    const correctPoolAccount = await connection.getAccountInfo(poolStatePDA);
    
    if (correctPoolAccount) {
      console.log('Pool account exists using correct seed!');
      console.log('Owner:', correctPoolAccount.owner.toString());
      console.log('Data size:', correctPoolAccount.data.length);
      
      if (correctPoolAccount.data.length >= 40) {
        // admin pubkey (32바이트) 추출 - 첫 8바이트 이후 시작
        const adminPubkeyBytes = correctPoolAccount.data.slice(8, 40);
        const adminPubkey = new PublicKey(adminPubkeyBytes);
        console.log('Admin pubkey:', adminPubkey.toString());
      }
    } else {
      console.log('Pool account does NOT exist using correct seed.');
    }
    
    // 잘못된 시드로 생성된 계정도 확인
    const wrongPoolAccount = await connection.getAccountInfo(wrongPDA);
    
    if (wrongPoolAccount) {
      console.log('\nWrong pool account exists!');
      console.log('Owner:', wrongPoolAccount.owner.toString());
      console.log('Data size:', wrongPoolAccount.data.length);
    } else {
      console.log('\nWrong pool account does NOT exist.');
    }
    
    // 특정 주소도 확인
    const targetAccount = await connection.getAccountInfo(new PublicKey(targetPDA));
    
    if (targetAccount) {
      console.log('\nTarget account exists!');
      console.log('Owner:', targetAccount.owner.toString());
      console.log('Data size:', targetAccount.data.length);
      
      if (targetAccount.data.length >= 40) {
        // admin pubkey (32바이트) 추출 - 첫 8바이트 이후 시작
        const adminPubkeyBytes = targetAccount.data.slice(8, 40);
        const adminPubkey = new PublicKey(adminPubkeyBytes);
        console.log('Admin pubkey:', adminPubkey.toString());
      }
    } else {
      console.log('\nTarget account does NOT exist.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPoolState();