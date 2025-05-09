/**
 * Supabase 클라이언트 및 데이터베이스 액세스 유틸리티
 * - 연결 풀링
 * - 쿼리 최적화
 * - 캐싱 지원
 */

import { createClient } from "@supabase/supabase-js";

// 환경 변수에서 Supabase 구성 가져오기
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 환경 변수 검증
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase URL or Anon Key not set in environment variables");
}

// 인스턴스 캐싱을 위한 클라이언트 인스턴스
let anonClientInstance = null;
let serviceClientInstance = null;

// 클라이언트 메모리 캐시
const queryCache = new Map();
const CACHE_TTL = 60 * 1000; // 기본 캐시 TTL: 1분

/**
 * 일반 권한(익명) Supabase 클라이언트 가져오기
 * @returns {object} Supabase 클라이언트 인스턴스
 */
export function getSupabase() {
  if (!anonClientInstance && SUPABASE_URL && SUPABASE_ANON_KEY) {
    anonClientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return anonClientInstance;
}

/**
 * 관리자 권한 Supabase 클라이언트 가져오기
 * @returns {object} Supabase 서비스 롤 클라이언트 인스턴스
 */
export function getSupabaseAdmin() {
  if (!serviceClientInstance && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    serviceClientInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return serviceClientInstance;
}

/**
 * 쿼리 결과 캐싱 및 캐시된 결과 검색
 * 
 * @param {string} cacheKey - 캐시 키
 * @param {Function} queryFn - 실행할 쿼리 함수
 * @param {number} ttl - 캐시 TTL(밀리초)
 * @returns {Promise<object>} 쿼리 결과
 */
export async function cachedQuery(cacheKey, queryFn, ttl = CACHE_TTL) {
  // 캐시된 결과가 있고 만료되지 않았으면 반환
  if (queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (cached.expires > Date.now()) {
      return cached.data;
    }
    // 만료된 항목 제거
    queryCache.delete(cacheKey);
  }
  
  // 쿼리 실행
  const result = await queryFn();
  
  // 결과 캐싱
  queryCache.set(cacheKey, {
    data: result,
    expires: Date.now() + ttl
  });
  
  return result;
}

/**
 * 캐시에서 특정 항목 또는 전체 캐시 제거
 * 
 * @param {string} cacheKey - 제거할 캐시 키 (없으면 전체 캐시 제거)
 */
export function clearCache(cacheKey = null) {
  if (cacheKey === null) {
    queryCache.clear();
  } else {
    queryCache.delete(cacheKey);
  }
}

/**
 * 페이지네이션을 위한 최적화된 쿼리
 * 
 * @param {object} supabase - Supabase 클라이언트
 * @param {string} table - 테이블 이름
 * @param {object} options - 쿼리 옵션
 * @returns {Promise<object>} 페이지네이션 결과
 */
export async function paginatedQuery(supabase, table, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    orderBy = 'created_at',
    ascending = false,
    filters = {},
    select = '*',
    countTotal = true
  } = options;
  
  // 시작 인덱스 계산
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  // 쿼리 구성
  let query = supabase.from(table).select(select, { count: countTotal });
  
  // 필터링 조건 적용
  for (const [column, value] of Object.entries(filters)) {
    if (typeof value === 'object' && value !== null) {
      const [operator, operand] = Object.entries(value)[0];
      switch (operator) {
        case 'eq': query = query.eq(column, operand); break;
        case 'neq': query = query.neq(column, operand); break;
        case 'gt': query = query.gt(column, operand); break;
        case 'gte': query = query.gte(column, operand); break;
        case 'lt': query = query.lt(column, operand); break;
        case 'lte': query = query.lte(column, operand); break;
        case 'in': query = query.in(column, operand); break;
        case 'contains': query = query.contains(column, operand); break;
        case 'ilike': query = query.ilike(column, `%${operand}%`); break;
      }
    } else {
      query = query.eq(column, value);
    }
  }
  
  // 정렬 적용
  query = query.order(orderBy, { ascending });
  
  // 페이지네이션 적용
  query = query.range(from, to);
  
  // 쿼리 실행
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    data,
    page,
    pageSize,
    total: count || 0,
    totalPages: count ? Math.ceil(count / pageSize) : 0
  };
}

/**
 * 대량 데이터 처리를 위한 배치 작업
 * 
 * @param {object} supabase - Supabase 클라이언트
 * @param {string} table - 테이블 이름
 * @param {string} operation - 작업 타입 ('insert', 'update', 'upsert', 'delete')
 * @param {Array} data - 데이터 배열
 * @param {number} batchSize - 배치 크기
 * @returns {Promise<Array>} 작업 결과 배열
 */
export async function batchOperation(supabase, table, operation, data, batchSize = 100) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  const results = [];
  
  // 배치 처리
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    let result;
    
    switch (operation) {
      case 'insert':
        result = await supabase.from(table).insert(batch);
        break;
      case 'update':
        // 업데이트의 경우 개별 레코드마다 적절한 필터 필요
        // 이 예시에서는 각 레코드에 'id' 필드가 있다고 가정
        for (const record of batch) {
          const { id, ...values } = record;
          const { data: updatedData, error } = await supabase
            .from(table)
            .update(values)
            .eq('id', id);
          results.push({ data: updatedData, error });
        }
        continue;
      case 'upsert':
        result = await supabase.from(table).upsert(batch);
        break;
      case 'delete':
        // 삭제의 경우 ID 배열만 필요
        result = await supabase.from(table).delete().in('id', batch);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    // 결과 수집
    results.push(result);
  }
  
  return results;
}

// 기본 내보내기
export default {
  getSupabase,
  getSupabaseAdmin,
  cachedQuery,
  clearCache,
  paginatedQuery,
  batchOperation
};