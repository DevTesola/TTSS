/**
 * NFT 관련 공통 유틸리티 함수
 * 이미지 처리, NFT 데이터 파싱 및 표준화를 위한 유틸리티
 */

// IPFS 기본 설정
const IPFS_CONFIG = {
  gateway: 'https://tesola.mypinata.cloud',
  imagesCid: process.env.NEXT_PUBLIC_IMAGES_CID || 'bafybeihq6qozwmf4t6omeyuunj7r7vdj26l4akuzmcnnu5pgemd6bxjike'
};

// 사용 가능한 미리보기 이미지
const DEFAULT_PREVIEW_IMAGES = [
  '/nft-previews/0119.png',
  '/nft-previews/0171.png',
  '/nft-previews/0327.png',
  '/nft-previews/0416.png',
  '/nft-previews/0418.png',
  '/nft-previews/0579.png'
];

// 기본 플레이스홀더 이미지
const PLACEHOLDER_IMAGE = '/placeholder-nft.png';

/**
 * NFT 데이터 가져오기 - Mint 주소로 NFT 조회
 * @param {string} mintAddress - NFT의 Mint 주소
 * @param {object} supabase - Supabase 클라이언트 인스턴스
 * @returns {Promise<object|null>} NFT 데이터 또는 null
 */
export async function getNFTData(mintAddress, supabase) {
  if (!mintAddress || !supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('minted_nfts')
      .select('*')
      .eq('mint_address', mintAddress)
      .single();
    
    if (error) {
      console.error('NFT 데이터 조회 오류:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('NFT 데이터 조회 중 예외 발생:', error);
    return null;
  }
}

/**
 * NFT 티어(등급) 표준화
 * @param {string} tierValue - 원본 티어 값
 * @returns {string} 표준화된 티어 값
 */
export function standardizeTier(tierValue) {
  if (!tierValue) return 'COMMON';
  
  // 문자열로 변환하고 앞뒤 공백 제거 후 대문자로 변환
  const normalized = String(tierValue).trim().toUpperCase();
  
  // 정확한 일치 확인
  if (["LEGENDARY", "EPIC", "RARE", "COMMON"].includes(normalized)) {
    return normalized;
  }
  
  // 부분 일치 확인
  if (normalized.includes("LEGEND") || normalized.includes("LEGENDARY")) {
    return "LEGENDARY";
  } else if (normalized.includes("EPIC")) {
    return "EPIC";
  } else if (normalized.includes("RARE")) {
    return "RARE";
  }
  
  // 기본값
  return "COMMON";
}

/**
 * IPFS URI를 게이트웨이 URL로 변환
 * @param {string} ipfsUri - IPFS URI (ipfs://... 형식)
 * @param {string} gateway - 사용할 게이트웨이 (기본값: Tesola Pinata)
 * @returns {string} 게이트웨이 URL
 */
export function ipfsToGatewayUrl(ipfsUri, gateway = IPFS_CONFIG.gateway) {
  if (!ipfsUri || typeof ipfsUri !== 'string') return '';
  
  if (ipfsUri.startsWith('ipfs://')) {
    const ipfsPath = ipfsUri.replace('ipfs://', '');
    return `${gateway}/ipfs/${ipfsPath}`;
  }
  
  // 이미 게이트웨이 URL인 경우 그대로 반환
  if (ipfsUri.includes('/ipfs/')) {
    // 게이트웨이 URL을 표준화
    try {
      const parts = ipfsUri.split('/ipfs/');
      if (parts.length > 1) {
        return `${gateway}/ipfs/${parts[1]}`;
      }
    } catch (err) {
      console.error('게이트웨이 URL 표준화 오류:', err);
    }
  }
  
  return ipfsUri;
}

/**
 * 게이트웨이 URL을 IPFS URI로 변환
 * @param {string} gatewayUrl - 게이트웨이 URL
 * @returns {string} IPFS URI (ipfs://... 형식) 또는 원본 URL
 */
export function gatewayUrlToIpfs(gatewayUrl) {
  if (!gatewayUrl || typeof gatewayUrl !== 'string') return '';
  
  if (gatewayUrl.includes('/ipfs/')) {
    const parts = gatewayUrl.split('/ipfs/');
    if (parts.length > 1) {
      return `ipfs://${parts[1]}`;
    }
  }
  
  return gatewayUrl;
}

/**
 * NFT의 IPFS 이미지 URL 생성
 * @param {number|string} id - NFT ID 또는 문자열 ID
 * @param {string} collectionCid - 컬렉션 IPFS CID
 * @returns {string} IPFS 이미지 URL
 */
export function generateNftImageUrl(id, collectionCid = IPFS_CONFIG.imagesCid) {
  if (!id) return '';
  
  // ID에서 숫자 추출
  let numericId = null;
  if (typeof id === 'string') {
    const match = id.match(/(\d+)/);
    if (match && match[1]) {
      numericId = match[1];
    }
  } else if (typeof id === 'number') {
    numericId = id.toString();
  }
  
  if (!numericId) return '';
  
  // 4자리 ID 형식으로 패딩
  const formattedId = String(numericId).padStart(4, '0');
  return `ipfs://${collectionCid}/${formattedId}.png`;
}

/**
 * NFT 이미지 URL 선택 - 다양한 소스에서 최적 이미지 URL 선택
 * @param {object} nft - NFT 객체
 * @returns {string} 선택된 이미지 URL 또는 기본 이미지 URL
 */
export function getNFTImageUrl(nft) {
  if (!nft) return PLACEHOLDER_IMAGE;
  
  // 이미지 필드 확인 순서
  const imageFieldsOrder = [
    // 메타데이터 이미지 (가장 신뢰할 수 있는 소스)
    nft.metadata?.image,
    // 직접 이미지 필드들
    nft.image,
    nft.image_url,
    nft.nft_image
  ];
  
  // IPFS URL 찾기
  for (const field of imageFieldsOrder) {
    if (field && typeof field === 'string' && field.startsWith('ipfs://')) {
      return ipfsToGatewayUrl(field);
    }
  }
  
  // 게이트웨이 URL 찾기
  for (const field of imageFieldsOrder) {
    if (field && typeof field === 'string' && field.includes('/ipfs/')) {
      return ipfsToGatewayUrl(field);
    }
  }
  
  // 일반 URL 찾기
  for (const field of imageFieldsOrder) {
    if (field && typeof field === 'string' && !field.startsWith('/')) {
      return field;
    }
  }
  
  // ID 기반 URL 생성 시도
  const id = nft.id || nft.mint_index || nft.token_id;
  if (id) {
    const ipfsUrl = generateNftImageUrl(id);
    if (ipfsUrl) {
      return ipfsToGatewayUrl(ipfsUrl);
    }
  }
  
  // 대체 이미지 URL 생성
  return getFallbackImage(nft);
}

/**
 * NFT 폴백 이미지 URL 생성
 * @param {object} nft - NFT 객체
 * @returns {string} 폴백 이미지 URL
 */
export function getFallbackImage(nft) {
  if (!nft) return PLACEHOLDER_IMAGE;
  
  try {
    // ID 또는 민트 주소 추출
    const id = nft.id || nft.mint_address || nft.mintAddress || nft.mint;
    
    if (id) {
      // 숫자 ID 추출 시도
      let numericId = null;
      
      // 이름에서 숫자 추출 시도 (예: "SOLARA #123")
      const nameMatch = (nft.name || nft.nft_name || '').match(/#\s*(\d+)/);
      if (nameMatch && nameMatch[1]) {
        numericId = parseInt(nameMatch[1]);
      }
      
      // ID에서 숫자 추출 시도
      if (numericId === null) {
        const idMatch = String(id).match(/(\d+)/);
        if (idMatch && idMatch[1]) {
          numericId = parseInt(idMatch[1]);
        }
      }
      
      // 문자열 해시 함수 - 일관된 이미지 선택
      const hashString = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // 32비트 정수로 변환
        }
        return Math.abs(hash);
      };
      
      // 숫자 ID로 이미지 선택
      if (numericId !== null) {
        const index = numericId % DEFAULT_PREVIEW_IMAGES.length;
        return DEFAULT_PREVIEW_IMAGES[index];
      }
      
      // ID 문자열로 해시 생성
      const hashedId = hashString(String(id));
      const index = hashedId % DEFAULT_PREVIEW_IMAGES.length;
      return DEFAULT_PREVIEW_IMAGES[index];
    }
  } catch (err) {
    console.error("폴백 이미지 생성 오류:", err);
  }
  
  // 기본 대체 이미지
  return PLACEHOLDER_IMAGE;
}

/**
 * NFT 이름 가져오기
 * @param {object} nft - NFT 객체
 * @param {string} defaultPrefix - 기본 이름 접두사
 * @returns {string} NFT 이름
 */
export function getNFTName(nft, defaultPrefix = 'SOLARA') {
  if (!nft) return `${defaultPrefix} NFT`;
  
  // 다양한 이름 필드 확인
  const name = 
    nft.name || 
    nft.nft_name || 
    nft.title ||
    nft.metadata?.name;
  
  if (name) return name;
  
  // ID 기반 이름 생성
  const id = nft.id || nft.nftId || nft.tokenId || 
            (nft.mint_address ? nft.mint_address.slice(0, 4) : null) ||
            (nft.mint ? nft.mint.slice(0, 4) : null);
  
  return id ? `${defaultPrefix} #${id}` : `${defaultPrefix} NFT`;
}

/**
 * NFT 티어(등급) 가져오기
 * @param {object} nft - NFT 객체
 * @returns {string} NFT 티어
 */
export function getNFTTier(nft) {
  if (!nft) return 'Common';
  
  // 직접 티어 필드 확인
  const tier = 
    nft.tier || 
    nft.nft_tier || 
    nft.rarity;
  
  if (tier) return tier;
  
  // 속성 배열에서 티어 속성 찾기
  const tierAttribute = nft.attributes?.find(
    attr => attr.trait_type?.toLowerCase() === 'tier' || 
            attr.trait_type?.toLowerCase() === 'rarity'
  );
  
  if (tierAttribute?.value) return tierAttribute.value;
  
  return 'Common'; // 기본값
}

export default {
  getNFTData,
  standardizeTier,
  ipfsToGatewayUrl,
  gatewayUrlToIpfs,
  generateNftImageUrl,
  getNFTImageUrl,
  getFallbackImage,
  getNFTName,
  getNFTTier,
  IPFS_CONFIG
};