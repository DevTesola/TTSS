/**
 * getStakingStats.js - 스테이킹 통계 조회 API
 * 
 * 사용자의 스테이킹 현황, 활성 스테이킹 목록, 보상 현황 등을 조회
 * - 활성 스테이킹 목록 조회
 * - 각 스테이킹의 진행 상황 및 보상 계산
 * - 실제 NFT 이미지 및 메타데이터 매핑
 * - 통합된 통계 정보 반환
 */

import { Connection } from '@solana/web3.js';
import { getSupabase } from '../../../shared/utils/supabase';
import { createApiResponse, getErrorMessage } from '../../../shared/utils/error-handler';
import { SOLANA_RPC_ENDPOINT } from '../../../shared/constants/network';
import { getNFTData } from '../../../shared/utils/nft';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json(
      createApiResponse(false, 'Method Not Allowed', null, 'Only GET requests are allowed')
    );
  }

  try {
    const { wallet, nocache } = req.query;
    
    // 필수 입력값 검증
    if (!wallet) {
      return res.status(400).json(
        createApiResponse(false, '지갑 주소가 필요합니다', null, 'Wallet address is required')
      );
    }
    
    // 캐시 방지 파라미터
    const cacheStr = nocache || Date.now();
    
    // Supabase 클라이언트 초기화
    const supabase = getSupabase();
    
    // 활성 스테이킹 레코드 조회
    const { data: stakingData, error: stakingError } = await supabase
      .from('nft_staking')
      .select('*, nft_tier')
      .eq('wallet_address', wallet)
      .eq('status', 'staked')
      .order('staked_at', { ascending: false });
    
    if (stakingError) {
      console.error('스테이킹 데이터 조회 오류:', stakingError);
      return res.status(500).json(
        createApiResponse(false, '스테이킹 데이터 조회에 실패했습니다', null, getErrorMessage(stakingError))
      );
    }
    
    // NFT 데이터 조회를 위한 민트 주소 추출
    const mintAddresses = stakingData.map(stake => stake.mint_address).filter(Boolean);
    console.log(`${mintAddresses.length}개의 민트 주소를 조회합니다`);
    
    // 민트 주소별 NFT 데이터 매핑
    let nftDataByMint = {};
    
    if (mintAddresses.length > 0) {
      // 민트 주소로 실제 NFT 데이터 조회
      const { data: nftData, error: nftError } = await supabase
        .from('minted_nfts')
        .select('*, metadata')
        .in('mint_address', mintAddresses);
      
      if (!nftError && nftData) {
        console.log(`${nftData.length}개의 NFT 정보를 minted_nfts 테이블에서 찾았습니다`);
        
        // 디버깅 정보 로깅
        nftData.forEach(nft => {
          console.log(`NFT ${nft.mint_index || nft.id} 상세 정보:`, {
            has_image_url: !!nft.image_url,
            image_url_type: nft.image_url ? (nft.image_url.startsWith('ipfs://') ? 'ipfs' : 
                                           (nft.image_url.startsWith('/') ? 'local' : 'other')) : 'none',
            has_metadata: !!nft.metadata,
            metadata_img: nft.metadata?.image ? 'yes' : 'no'
          });
        });
        
        // 민트 주소별 조회 매핑 생성
        nftDataByMint = nftData.reduce((acc, nft) => {
          if (nft.mint_address) {
            acc[nft.mint_address] = nft;
          }
          return acc;
        }, {});
      } else if (nftError) {
        console.error('NFT 데이터 조회 오류:', nftError);
      }
    }
    
    // 스테이킹 데이터 처리 및 계산
    const currentDate = new Date();
    let projectedRewards = 0;
    let earnedToDate = 0;
    
    const activeStakes = stakingData.map(stake => {
      const stakingStartDate = new Date(stake.staked_at);
      const releaseDate = new Date(stake.release_date);
      
      // 총 스테이킹 기간 계산 (밀리초)
      const totalStakingDuration = releaseDate.getTime() - stakingStartDate.getTime();
      
      // 경과 기간 계산 (총 기간으로 제한)
      const elapsedDuration = Math.min(
        currentDate.getTime() - stakingStartDate.getTime(),
        totalStakingDuration
      );
      
      // 진행률 계산
      const progressPercentage = (elapsedDuration / totalStakingDuration) * 100;
      
      // 현재까지 획득한 보상 계산
      const earnedSoFar = (stake.total_rewards * progressPercentage) / 100;
      
      // 총계에 추가
      projectedRewards += parseFloat(stake.total_rewards);
      earnedToDate += parseFloat(earnedSoFar);
      
      // 남은 일수 계산
      const daysRemaining = Math.max(0, Math.ceil((releaseDate - currentDate) / (1000 * 60 * 60 * 24)));
      
      // 스테이킹 기간 완료 여부
      const isUnlocked = currentDate >= releaseDate;
      
      // 경과 일수 계산
      const daysElapsed = Math.min(
        Math.ceil(elapsedDuration / (1000 * 60 * 60 * 24)),
        stake.staking_period
      );
      
      // 실제 NFT 데이터 확인
      const actualNft = nftDataByMint[stake.mint_address];
      
      // NFT ID 추출
      const nftId = actualNft?.mint_index || actualNft?.id || stake.id || 
                   (stake.mint_address ? stake.mint_address.slice(0, 8) : '0');
      
      console.log(`NFT ID: ${nftId}, 민트 주소: ${stake.mint_address} 처리 중`);
      
      // 이미지 URL 관련 변수 초기화
      let nftImageUrl = null;
      let ipfsHash = null;
      let ipfsUrl = null;
      let gatewayUrl = null;
      let previewImage = null;
      
      // 실제 NFT 데이터가 있는 경우
      if (actualNft) {
        console.log(`민트 주소 ${stake.mint_address}의 실제 NFT 데이터를 찾았습니다`);
        
        // 이미지 URL 설정 (image_url 필드)
        if (actualNft.image_url) {
          nftImageUrl = actualNft.image_url;
          console.log(`데이터베이스의 실제 image_url 사용: ${nftImageUrl}`);
          
          // IPFS URL 처리
          if (nftImageUrl.startsWith('ipfs://')) {
            ipfsUrl = nftImageUrl;
            
            // IPFS 해시 추출
            const hashParts = ipfsUrl.replace('ipfs://', '').split('/');
            ipfsHash = hashParts[0];
            
            // 파일 경로 추출
            const filePath = '/' + (hashParts.slice(1).join('/') || '');
            
            // 게이트웨이 URL 생성
            gatewayUrl = `https://tesola.mypinata.cloud/ipfs/${ipfsHash}${filePath}`;
            console.log(`게이트웨이 URL 생성: ${gatewayUrl}, IPFS URL: ${ipfsUrl}`);
          }
          // 이미 게이트웨이 URL인 경우
          else if (nftImageUrl.includes('/ipfs/')) {
            gatewayUrl = nftImageUrl;
            
            // IPFS URL 역으로 생성
            const parts = gatewayUrl.split('/ipfs/');
            if (parts.length > 1) {
              ipfsHash = parts[1].split('/')[0];
              ipfsUrl = `ipfs://${parts[1]}`;
            }
          }
        }
        // 메타데이터에서 이미지 URL 추출
        else if (actualNft.metadata?.image) {
          nftImageUrl = actualNft.metadata.image;
          console.log(`메타데이터의 이미지 URL 사용: ${nftImageUrl}`);
          
          if (nftImageUrl.startsWith('ipfs://')) {
            ipfsUrl = nftImageUrl;
            ipfsHash = ipfsUrl.replace('ipfs://', '').split('/')[0];
            
            // 파일 경로 추출 및 게이트웨이 URL 생성
            const filePath = ipfsUrl.replace(`ipfs://${ipfsHash}`, '') || '/';
            gatewayUrl = `https://tesola.mypinata.cloud/ipfs/${ipfsHash}${filePath}`;
          }
        }
        // NFT 인덱스로 이미지 경로 생성
        else if (actualNft.mint_index) {
          const formattedId = String(actualNft.mint_index).padStart(4, '0');
          nftImageUrl = `/nft-images/${formattedId}.png`;
          console.log(`mint_index에서 생성된 이미지 경로 사용: ${nftImageUrl}`);
        }
      }
      
      // 실제 NFT 데이터가 없는 경우
      if (!nftImageUrl) {
        console.log(`실제 이미지 URL을 찾을 수 없음, NFT ID: ${nftId}에 대해 생성된 데이터 사용`);
        
        // IPFS 해시 설정
        if (!ipfsHash) {
          ipfsHash = stake.ipfs_hash;
          
          if (!ipfsHash) {
            // 실제 TESOLA 컬렉션의 IPFS CID
            const COLLECTION_IPFS_HASH = process.env.NEXT_PUBLIC_IMAGES_CID || 'bafybeihq6qozwmf4t6omeyuunj7r7vdj26l4akuzmcnnu5pgemd6bxjike';
            ipfsHash = COLLECTION_IPFS_HASH;
          }
          
          // 4자리 ID로 포맷팅
          let formattedId;
          
          // stake.id 사용 (숫자만 추출)
          if (stake.id) {
            try {
              const numericId = parseInt(String(stake.id).replace(/\D/g, '') || '0');
              formattedId = String(numericId).padStart(4, '0');
              console.log(`숫자 ID 기반 포맷팅: ${formattedId} (원본 ID: ${stake.id})`);
            } catch (err) {
              formattedId = '0001';
              console.log(`ID 변환 실패, 기본값 사용: ${formattedId}`);
            }
          } else if (nftId) {
            // NFT ID 사용 (숫자만 추출하고 4자리로 포맷팅)
            try {
              const numericId = parseInt(String(nftId).replace(/\D/g, '') || '0');
              formattedId = String(numericId).padStart(4, '0');
              console.log(`일반 NFT ID 포맷팅: ${formattedId} (원본: ${nftId})`);
            } catch (err) {
              formattedId = '0001';
              console.log(`NFT ID 변환 실패, 기본값 사용: ${formattedId}`);
            }
          } else {
            // ID 정보가 없는 경우
            formattedId = '0001';
            console.log(`ID 정보 없음, 기본값 사용: ${formattedId}`);
          }
          
          // IPFS URL 생성
          ipfsUrl = `ipfs://${ipfsHash}/${formattedId}.png`;
          gatewayUrl = `https://tesola.mypinata.cloud/ipfs/${ipfsHash}/${formattedId}.png`;
          
          console.log(`포맷팅된 ID로 IPFS URL 생성: ${formattedId}, URL: ${ipfsUrl}`);
        }
        
        // 생성된 IPFS URL을 기본 이미지 URL로 설정
        nftImageUrl = ipfsUrl;
      }
      
      // 로컬 이미지를 IPFS 플레이스홀더로 변환
      const previewImages = ['0119.png', '0171.png', '0327.png', '0416.png', '0418.png', '0579.png'];
      const numericId = parseInt(String(nftId).replace(/\D/g, '') || '1');
      previewImage = `/nft-previews/${previewImages[Math.abs(numericId % previewImages.length)]}`;
      
      // 로컬 경로 확인 함수
      const isLocalPath = (url) => {
        if (!url) return false;
        return url.startsWith('/') || 
               url.includes('/nft-') || 
               url.includes('/placeholder') || 
               url.includes('/public/') ||
               url === 'placeholder-nft.png';
      };
      
      // IPFS URL이 없거나 로컬 경로인 경우
      if (!nftImageUrl || isLocalPath(nftImageUrl)) {
        // 로컬 이미지 경로나 이미지가 없는 경우 IPFS 플레이스홀더로 변환
        const randomId = Math.random().toString(36).substring(2, 10);
        console.log(`로컬 이미지 경로 또는 빈 이미지 URL을 IPFS 플레이스홀더로 변환: ${nftImageUrl} -> ipfs://placeholder/${randomId}`);
        nftImageUrl = `ipfs://placeholder/${randomId}`;
      }
      
      // 실제 NFT 데이터가 있으면 이름 및 기타 세부 정보 포함
      const nftName = actualNft?.name || stake.nft_name || `SOLARA #${nftId}`;
      const nftTier = actualNft?.metadata?.attributes?.find(attr => 
        attr.trait_type?.toLowerCase() === 'tier' || attr.trait_type?.toLowerCase() === 'rarity'
      )?.value || stake.nft_tier || 'Common';
      
      // 계산된 필드가 추가된 스테이킹 정보 반환
      return {
        ...stake,
        progress_percentage: parseFloat(progressPercentage.toFixed(2)),
        earned_so_far: parseFloat(earnedSoFar.toFixed(2)),
        days_remaining: daysRemaining,
        days_elapsed: daysElapsed,
        is_unlocked: isUnlocked,
        current_apy: calculateCurrentAPY(stake),
        
        // 실제 NFT 데이터에서 가져온 NFT 세부 정보
        nft_name: nftName,
        nft_tier: nftTier,
        
        // 이미지 필드 통합 처리
        ipfs_hash: ipfsHash,
        image: nftImageUrl,
        image_url: nftImageUrl,
        nft_image: gatewayUrl || nftImageUrl,
        
        // 디버깅 정보
        _debug_image_source: actualNft ? "actual_nft_data" : "generated",
        
        // 실제 NFT 데이터 사용 여부 플래그
        using_actual_nft_data: !!actualNft,
        
        // 추가 API 소비자를 위한 메타데이터
        metadata: actualNft?.metadata || {
          name: nftName,
          attributes: [
            { trait_type: "Tier", value: nftTier }
          ],
          image: nftImageUrl
        }
      };
    });
    
    // 소수점 값 포맷팅
    projectedRewards = parseFloat(projectedRewards.toFixed(2));
    earnedToDate = parseFloat(earnedToDate.toFixed(2));
    
    // 스테이킹이 없으면 테스트용 모의 데이터 생성
    if (activeStakes.length === 0) {
      console.log('스테이킹 데이터가 없어 테스트용 모의 데이터를 생성합니다');
      
      // 테스트 UI용 모의 데이터 생성
      const mockStats = generateMockStakingData(wallet);
      
      console.log('이미지 필드가 포함된 모의 데이터 반환:',
        mockStats.activeStakes.length > 0 ? {
          image: mockStats.activeStakes[0].image,
          image_url: mockStats.activeStakes[0].image_url,
          nft_image: mockStats.activeStakes[0].nft_image,
          ipfs_hash: mockStats.activeStakes[0].ipfs_hash
        } : '모의 스테이킹 없음'
      );
      
      return res.status(200).json(
        createApiResponse(true, '모의 스테이킹 데이터를 생성했습니다', {
          activeStakes: mockStats.activeStakes,
          stats: mockStats.stats,
          isMockData: true,
          fetchTime: new Date().toISOString()
        })
      );
    }
    
    // 데이터 샘플 로깅
    if (activeStakes && activeStakes.length > 0) {
      console.log('getStakingStats API - 첫 번째 stake 이미지 필드 확인:', {
        image: activeStakes[0].image,
        image_url: activeStakes[0].image_url,
        nft_image: activeStakes[0].nft_image,
        ipfs_hash: activeStakes[0].ipfs_hash
      });
      
      console.log('getStakingStats API - 첫 번째 stake 상세 정보:', {
        id: activeStakes[0].id,
        mint_address: activeStakes[0].mint_address,
        image: activeStakes[0].image,
        image_url: activeStakes[0].image_url,
        nft_image: activeStakes[0].nft_image,
        ipfs_hash: activeStakes[0].ipfs_hash,
        metadata: activeStakes[0].metadata ? '있음' : '없음',
        mint_index: activeStakes[0].mint_index
      });
    }
    
    // 처리된 데이터 반환
    return res.status(200).json(
      createApiResponse(true, '스테이킹 통계를 성공적으로 조회했습니다', {
        activeStakes,
        stats: {
          totalStaked: activeStakes.length,
          projectedRewards,
          earnedToDate
        },
        debug: {
          image_fields_sample: activeStakes.length > 0 ? {
            image: activeStakes[0].image,
            image_url: activeStakes[0].image_url,
            nft_image: activeStakes[0].nft_image,
            starts_with_ipfs: activeStakes[0].image?.startsWith('ipfs://')
          } : null,
          has_actual_nft_data: activeStakes.some(s => s.using_actual_nft_data),
          source: "enhanced_getStakingStats"
        },
        fetchTime: new Date().toISOString()
      })
    );
    
  } catch (error) {
    console.error('getStakingStats API 오류:', error);
    return res.status(500).json(
      createApiResponse(false, '내부 서버 오류가 발생했습니다', null, getErrorMessage(error))
    );
  }
}

/**
 * 스테이킹의 현재 APY(연간 수익률) 계산
 * @param {Object} stake - 스테이킹 데이터 객체
 * @returns {number} 연간 수익률
 */
function calculateCurrentAPY(stake) {
  const dailyRate = stake.daily_reward_rate || 25; // 설정되지 않은 경우 기본값 25
  
  // 기본 APY 계산 (일일 보상 * 365 / 총 보상) * 100
  const baseAPY = (dailyRate * 365 / stake.total_rewards) * 100;
  
  // 장기 스테이킹 보너스
  let stakingBonus = 0;
  if (stake.staking_period >= 365) stakingBonus = 100; // +100%
  else if (stake.staking_period >= 180) stakingBonus = 70; // +70%
  else if (stake.staking_period >= 90) stakingBonus = 40; // +40%
  else if (stake.staking_period >= 30) stakingBonus = 20; // +20%
  
  return parseFloat((baseAPY * (1 + stakingBonus / 100)).toFixed(2));
}

/**
 * 테스트 목적의 모의 스테이킹 데이터 생성
 * @param {string} wallet - 지갑 주소
 * @returns {Object} activeStakes와 stats를 포함하는 객체
 */
function generateMockStakingData(wallet) {
  // 1-3개의 모의 스테이킹 NFT 생성
  const mockStakes = [];
  const tiers = [
    { name: 'LEGENDARY', dailyRate: 200 },
    { name: 'EPIC', dailyRate: 100 },
    { name: 'RARE', dailyRate: 50 },
    { name: 'COMMON', dailyRate: 25 }
  ];
  
  // 사용 가능한 NFT 미리보기 이미지
  const previewImages = ['0119.png', '0171.png', '0327.png', '0416.png', '0418.png', '0579.png'];
  
  // 실제 TESOLA 컬렉션의 IPFS CID
  const COLLECTION_IPFS_HASH = process.env.NEXT_PUBLIC_IMAGES_CID || 'bafybeihq6qozwmf4t6omeyuunj7r7vdj26l4akuzmcnnu5pgemd6bxjike';
  
  // 개인 게이트웨이 설정
  const PERSONAL_GATEWAY = 'https://tesola.mypinata.cloud/ipfs/';
  
  // 백업 게이트웨이 옵션
  const BACKUP_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://nftstorage.link/ipfs/'
  ];
  
  // 일관된 결과를 위한 지갑 주소 해싱
  const hash = Array.from(wallet).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const stakesCount = (hash % 3) + 1; // 1-3개 스테이킹
  
  let totalProjected = 0;
  let totalEarned = 0;
  
  // 테스트 지갑에 대한 실제 NFT 데이터 가져오기 시도
  console.log(`모의 스테이킹을 위한 실제 NFT 데이터 가져오기 시도: ${wallet}`);
  
  for (let i = 0; i < stakesCount; i++) {
    // 지갑과 인덱스 기반 고유 ID 생성
    const id = ((hash + i) % 999) + 1;
    
    // 지갑 해시에 따른 등급 선택 (테스트용 가중치 적용)
    const tierIndex = (hash + i) % 4;
    const tier = tiers[tierIndex];
    
    // 다양한 스테이킹 날짜 및 기간 생성
    const now = new Date();
    
    // 스테이킹 시작 날짜 (1-60일 전)
    const daysAgo = ((hash + i * 13) % 60) + 1;
    const stakingStartDate = new Date(now);
    stakingStartDate.setDate(stakingStartDate.getDate() - daysAgo);
    
    // 스테이킹 기간 (30-365일)
    const stakingPeriod = [30, 90, 180, 365][((hash + i * 7) % 4)];
    const releaseDate = new Date(stakingStartDate);
    releaseDate.setDate(releaseDate.getDate() + stakingPeriod);
    
    // 보상 계산
    const totalRewards = tier.dailyRate * stakingPeriod;
    
    // 진행 상황 계산
    const totalStakingDuration = releaseDate.getTime() - stakingStartDate.getTime();
    const elapsedDuration = Math.min(
      now.getTime() - stakingStartDate.getTime(),
      totalStakingDuration
    );
    const progressPercentage = (elapsedDuration / totalStakingDuration) * 100;
    const earnedSoFar = (totalRewards * progressPercentage) / 100;
    
    // 남은 일수 계산
    const daysRemaining = Math.max(0, Math.ceil((releaseDate - now) / (1000 * 60 * 60 * 24)));
    
    // 경과 일수 계산
    const daysElapsed = Math.min(
      Math.ceil(elapsedDuration / (1000 * 60 * 60 * 24)),
      stakingPeriod
    );
    
    // getUserNFTs 기능과 일치하는 이미지 소스 선택
    const ipfsHash = COLLECTION_IPFS_HASH;
    const imageIndex = id % previewImages.length;
    
    // 모든 경우에 일관되게 숫자 ID로 포맷팅 (4자리)
    const mockMintAddress = `mock${id}${wallet.substr(0, 8)}`;
    const formattedId = String(id).padStart(4, '0'); // 직접 숫자 ID 사용
    
    // 항상 IPFS URL 사용하여 일관성 유지
    const ipfsUrl = `ipfs://${ipfsHash}/${formattedId}.png`;
    
    // 게이트웨이 URL 생성
    const gatewayUrl = `${PERSONAL_GATEWAY}${ipfsHash}/${formattedId}.png`;
    
    // 모든 이미지 필드가 있는 모의 스테이킹 생성
    const mockStake = {
      id: `mock-stake-${i}-${id}`,
      wallet_address: wallet,
      mint_address: `mock${id}${wallet.substr(0, 8)}`,
      nft_name: `SOLARA #${id}`,
      nft_tier: tier.name,
      staking_period: stakingPeriod,
      staked_at: stakingStartDate.toISOString(),
      release_date: releaseDate.toISOString(),
      total_rewards: totalRewards,
      daily_reward_rate: tier.dailyRate,
      status: 'staked',
      
      // 이미지 필드 통합 처리
      ipfs_hash: ipfsHash,
      image: ipfsUrl,
      image_url: ipfsUrl,
      nft_image: gatewayUrl,
      _debug_image_source: "mock_data",
      
      // 컴포넌트에서 찾을 수 있는 메타데이터 필드 포함
      metadata: {
        image: ipfsUrl,
        name: `SOLARA #${id}`,
        attributes: [
          { trait_type: "Tier", value: tier.name },
          { trait_type: "Background", value: ["Cosmic", "Nebula", "Deep Space", "Starfield"][id % 4] }
        ]
      },
      
      // 모의 데이터 플래그
      is_mock_data: true,
      
      // 계산된 필드
      progress_percentage: parseFloat(progressPercentage.toFixed(2)),
      earned_so_far: parseFloat(earnedSoFar.toFixed(2)),
      days_remaining: daysRemaining,
      days_elapsed: daysElapsed,
      is_unlocked: now >= releaseDate,
      current_apy: calculateCurrentAPY({
        daily_reward_rate: tier.dailyRate,
        total_rewards: totalRewards,
        staking_period: stakingPeriod
      })
    };
    
    mockStakes.push(mockStake);
    totalProjected += totalRewards;
    totalEarned += earnedSoFar;
  }
  
  console.log(`개인 게이트웨이를 사용하여 개선된 이미지 필드로 ${mockStakes.length}개의 모의 스테이킹 생성`);
  
  return {
    activeStakes: mockStakes,
    stats: {
      totalStaked: mockStakes.length,
      projectedRewards: parseFloat(totalProjected.toFixed(2)),
      earnedToDate: parseFloat(totalEarned.toFixed(2))
    }
  };
}