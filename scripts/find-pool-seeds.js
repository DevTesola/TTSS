// find-pool-seeds.js
const { PublicKey } = require('@solana/web3.js');

async function findPoolSeeds() {
  try {
    const PROGRAM_ID = new PublicKey('4SfUyQkbeyz9jeJDsR5XiUf8DATVZJXtGG4JUsYsWzTs');
    const TARGET_PDA = new PublicKey('8cQViUpNWGhw2enYUNyp2WRWXAwdQbZokiATBr1Xc5uP');
    
    console.log('시드 검색 시작...');
    
    // 다양한 시드 조합 시도
    const seedCandidates = [
      Buffer.from([112, 111, 111, 108]), // "pool"
      Buffer.from("pool"),
      Buffer.from("pool_state"),
      Buffer.from("staking_pool"),
      Buffer.from("nft_staking"),
      Buffer.from("global"),
      Buffer.from("state"),
    ];
    
    for (const seed of seedCandidates) {
      try {
        const [pda, bump] = PublicKey.findProgramAddressSync(
          [seed],
          PROGRAM_ID
        );
        
        console.log(`시드 "${seed.toString()}" 결과:`, {
          pda: pda.toString(),
          bump,
          matches: pda.equals(TARGET_PDA)
        });
        
        if (pda.equals(TARGET_PDA)) {
          console.log('✅ 일치하는 시드를 찾았습니다!', {
            seed: seed.toString(),
            bump
          });
        }
      } catch (err) {
        console.error(`시드 "${seed.toString()}" 처리 중 오류:`, err);
      }
    }
    
    // 추가로 특수 시드 조합도 시도
    console.log('\n복합 시드 시도...');
    
    // 특수 시드 조합들
    const combinationTests = [
      { 
        description: "pool + bump",
        seedFn: (bump) => [Buffer.from("pool"), Buffer.from([bump])]
      },
      {
        description: "program_id + pool",
        seedFn: () => [PROGRAM_ID.toBuffer().slice(0, 4), Buffer.from("pool")]
      },
      {
        description: "initialize",
        seedFn: () => [Buffer.from("initialize")]
      },
      {
        description: "global + initialize", 
        seedFn: () => [Buffer.from("global"), Buffer.from("initialize")]
      }
    ];
    
    for (const test of combinationTests) {
      // 다양한 범위의 bump 값 시도
      for (let bump = 254; bump >= 240; bump--) {
        try {
          const seeds = test.seedFn(bump);
          const [pda, foundBump] = PublicKey.findProgramAddressSync(
            seeds, 
            PROGRAM_ID
          );
          
          // 일치 여부 확인
          if (pda.equals(TARGET_PDA)) {
            console.log(`✅ 일치하는 복합 시드 발견! ${test.description}, bump=${foundBump}`, {
              seedDetails: seeds.map(s => s.toString()),
              pda: pda.toString()
            });
            break;
          }
        } catch (err) {
          // 오류 무시
        }
      }
    }
    
    console.log('시드 검색 완료');
  } catch (error) {
    console.error('전체 오류:', error);
  }
}

findPoolSeeds();