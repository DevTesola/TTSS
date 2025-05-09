/**
 * claim-rewards-test.js - 리워드 청구 API 테스트 스크립트
 *
 * 이 스크립트는 prepareClaimRewards API와 통합된 청구 워크플로우를 테스트합니다.
 * 실제 트랜잭션 서명 없이도 API 응답을 검증할 수 있습니다.
 */

const { PublicKey, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const { colors, callApi, sleep, assert } = require('./api-test-helpers');

// 테스트 설정
const API_BASE_URL = 'http://localhost:3000/api';
// 테스트용 지갑 주소 (실제 devnet 지갑 주소여야 함)
const TEST_WALLET = '8h2QEZyi79KcYBhmoo9RwGASGRQEagPvGM7VCzbuTGvi';
// 테스트용 NFT 민트 주소 (실제 devnet에 존재해야 함)
const TEST_NFT_MINT = 'DWq8eDQRfQZhJnE4r8V84JXV2GmkGeavpGahzYpqpGxm';

/**
 * 리워드 청구 준비 API 테스트
 * @returns {Promise<Object>} 트랜잭션 데이터
 */
async function testPrepareClaimRewards() {
  console.log(`\n${colors.magenta}===== 리워드 청구 준비 API 테스트 =====${colors.reset}`);

  try {
    // 1. prepareClaimRewards API 호출
    const data = await callApi(API_BASE_URL, '/prepareClaimRewards', {
      wallet: TEST_WALLET,
      mintAddress: TEST_NFT_MINT
    }, { timeout: 60000 }); // 60초 타임아웃

    // 2. 응답 구조 검증
    console.log(`${colors.yellow}[검증]${colors.reset} 응답 구조 확인 중...`);

    assert.hasProperty(data, 'success', '응답에 success 필드가 있어야 함');
    assert.isTrue(data.success, 'API가 성공 상태를 반환해야 함');
    assert.hasProperty(data, 'transactionBase64', '응답에 transactionBase64 필드가 있어야 함');

    console.log(`트랜잭션 길이: ${data.transactionBase64.length} 바이트`);

    if (data.claimDetails) {
      console.log(`${colors.cyan}[청구 상세 정보]${colors.reset}`);
      console.log(`- NFT 민트: ${data.claimDetails.nftMint}`);
      console.log(`- 스테이킹 기간: ${data.claimDetails.stakingPeriod || 'N/A'} 일`);
      console.log(`- 스테이킹 시작: ${data.claimDetails.stakingStartDate || 'N/A'}`);
      console.log(`- 마지막 청구: ${data.claimDetails.lastClaimDate || 'N/A'}`);
    }

    return data;
  } catch (error) {
    console.log(`${colors.red}[테스트 실패]${colors.reset} 리워드 청구 준비 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 청구 완료 API 테스트 (모의 서명)
 * @param {Object} prepareData - 청구 준비 데이터
 * @returns {Promise<Object>} 완료 응답 데이터
 */
async function testCompleteClaimRewards(prepareData) {
  console.log(`\n${colors.magenta}===== 리워드 청구 완료 API 테스트 =====${colors.reset}`);

  // 모의 트랜잭션 서명 생성 (실제 유효한 서명이 아님)
  const mockSignature = bs58.encode(Buffer.from(new Array(64).fill(0).map(() => Math.floor(Math.random() * 256))));
  console.log(`${colors.yellow}[모의 서명]${colors.reset} ${mockSignature}`);

  try {
    // 청구 완료 API 호출
    const data = await callApi(API_BASE_URL, '/staking/completeClaimRewards', {
      wallet: TEST_WALLET,
      signature: mockSignature,
      mintAddress: TEST_NFT_MINT,
      claimId: prepareData.claim?.id || 'test-claim-id'
    }, { timeout: 60000 }); // 60초 타임아웃

    // 응답 구조 검증
    console.log(`${colors.yellow}[검증]${colors.reset} 응답 구조 확인 중...`);
    assert.hasProperty(data, 'success', '응답에 success 필드가 있어야 함');
    assert.isTrue(data.success, 'API가 성공 상태를 반환해야 함');

    console.log(`${colors.green}[검증 통과]${colors.reset} 청구 완료 확인됨`);

    return data;
  } catch (error) {
    console.log(`${colors.red}[테스트 실패]${colors.reset} 리워드 청구 완료 실패: ${error.message}`);
    console.log('참고: 이 실패는 예상된 것일 수 있습니다 (모의 서명이므로)');

    // 이 부분은 실패해도 진행할 수 있음 (모의 서명이므로 블록체인에서 검증 실패 예상)
    return {
      success: false,
      error: error.message,
      note: '모의 서명 사용으로 인한 예상된 실패입니다'
    };
  }
}

/**
 * 오류 처리 테스트 (잘못된 입력으로 API 호출)
 */
async function testErrorHandling() {
  console.log(`\n${colors.magenta}===== 오류 처리 테스트 =====${colors.reset}`);

  // 테스트 케이스들
  const testCases = [
    {
      name: '지갑 주소 누락',
      data: { mintAddress: TEST_NFT_MINT }
    },
    {
      name: 'NFT 민트 주소 누락',
      data: { wallet: TEST_WALLET }
    },
    {
      name: '잘못된 지갑 주소',
      data: { wallet: 'invalid-address', mintAddress: TEST_NFT_MINT }
    },
    {
      name: '잘못된 NFT 민트 주소',
      data: { wallet: TEST_WALLET, mintAddress: 'invalid-mint' }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${colors.yellow}[테스트]${colors.reset} ${testCase.name}`);

    try {
      await callApi(API_BASE_URL, '/prepareClaimRewards', testCase.data, { timeout: 30000 });
      console.log(`${colors.red}[실패]${colors.reset} 오류가 발생해야 하는데 성공 응답을 받음`);
    } catch (error) {
      console.log(`${colors.green}[성공]${colors.reset} 예상대로 오류 발생: ${error.message}`);
    }

    // 테스트 간 딜레이 추가
    await sleep(1000);
  }
}

/**
 * 모든 테스트 실행
 */
async function runAllTests() {
  console.log(`${colors.magenta}======= 리워드 청구 API 테스트 시작 =======${colors.reset}`);
  console.log(`테스트 지갑: ${TEST_WALLET}`);
  console.log(`테스트 NFT: ${TEST_NFT_MINT}`);
  console.log(`API 기본 URL: ${API_BASE_URL}`);
  console.log(`실행 시간: ${new Date().toISOString()}`);

  try {
    // 1. 청구 준비 API 테스트
    console.log(`\n${colors.cyan}[1/3]${colors.reset} 청구 준비 API 테스트 시작...`);
    const prepareData = await testPrepareClaimRewards();

    // 2. 청구 완료 API 테스트
    console.log(`\n${colors.cyan}[2/3]${colors.reset} 청구 완료 API 테스트 시작...`);
    await testCompleteClaimRewards(prepareData);

    // 3. 오류 처리 테스트
    console.log(`\n${colors.cyan}[3/3]${colors.reset} 오류 처리 테스트 시작...`);
    await testErrorHandling();

    console.log(`\n${colors.green}======= 모든 테스트 완료 =======${colors.reset}`);
    process.exit(0);
  } catch (error) {
    console.log(`\n${colors.red}======= 테스트 실패 =======${colors.reset}`);
    console.log(`오류: ${error.message}`);
    console.log(`스택 트레이스:\n${error.stack}`);
    process.exit(1);
  }
}

// 테스트 실행
console.log('리워드 청구 API 테스트 스크립트 실행 중...');
runAllTests().catch(err => {
  console.error('테스트 실행 중 처리되지 않은 오류:', err);
  process.exit(1);
});