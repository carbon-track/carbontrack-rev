import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSystemLogs, fetchSystemLogDetail } from '../lib/api/systemLogs';

export function useSystemLogs(filters) {
  return useQuery({
    queryKey: ['systemLogs', filters],
    queryFn: () => fetchSystemLogs(filters),
    keepPreviousData: true,
  });
}

export function useSystemLogDetail(id) {
  return useQuery({
    queryKey: ['systemLog', id],
    queryFn: () => fetchSystemLogDetail(id),
    enabled: !!id,
  });
}

export function usePrefetchSystemLog() {
  const qc = useQueryClient();
  return (id) => {
    qc.prefetchQuery({ queryKey: ['systemLog', id], queryFn: () => fetchSystemLogDetail(id) });
  };
}
