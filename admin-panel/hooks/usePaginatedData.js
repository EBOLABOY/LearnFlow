// 通用分页数据获取 Hook（React）
// 统一管理 loading / pagination / filters / 搜索与刷新逻辑
// 注意：此文件需使用 UTF-8 编码

import { useState, useEffect, useMemo, useCallback } from 'react';

function getByPath(obj, path) {
  if (!path) return obj;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function usePaginatedData({ fetcher, initialFilters, dataPath = 'data.items', defaultSort = { key: 'created_at', direction: 'desc' } }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState(initialFilters || { page: 1, limit: 20 });
  const [sort, setSort] = useState(defaultSort || { key: 'created_at', direction: 'desc' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (sort?.key) {
        params.sortBy = sort.key;
        params.sortDir = sort.direction;
      }
      const resp = await fetcher(params);
      const ok = !!resp?.data?.success;
      if (ok) {
        const payload = resp.data?.data || {};
        const items = getByPath({ data: payload }, dataPath) || [];
        setData(items);
        setPagination(payload.pagination || {});
      } else {
        // 失败时保持原数据，但标记为已完成加载
      }
    } finally {
      setLoading(false);
    }
  }, [fetcher, filters, sort, dataPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = useCallback((newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  // 简易防抖实现（无需外部依赖），用于搜索输入
  const debouncedSearch = useMemo(() => {
    let timer = null;
    return (term, key = 'search', extra = {}) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setFilters((prev) => ({ ...prev, [key]: term, page: 1, ...extra }));
      }, 500);
    };
  }, []);

  const refresh = useCallback(() => {
    // 触发重新获取（保持当前 filters）
    fetchData();
  }, [fetchData]);

  const handleSort = useCallback((newKey) => {
    setSort((prev) => ({
      key: newKey,
      direction: prev.key === newKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    // 改变排序时回到第一页
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, []);

  return { data, loading, pagination, filters, setFilters, handlePageChange, debouncedSearch, refresh, sort, handleSort };
}

export default usePaginatedData;
