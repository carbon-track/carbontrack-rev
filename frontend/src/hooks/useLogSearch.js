import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchLogs } from '../lib/api/logSearch';

export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useLogSearch(params) {
  const debouncedQ = useDebouncedValue(params.q || '');
  const finalParams = { ...params, q: debouncedQ };
  return useQuery({
    queryKey: ['logSearch', finalParams],
    queryFn: () => searchLogs(finalParams),
    keepPreviousData: true,
  });
}
