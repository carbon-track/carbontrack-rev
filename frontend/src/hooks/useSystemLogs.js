import { useQuery, useQueryClient } from 'react-query';
import { fetchSystemLogs, fetchSystemLogDetail } from '../lib/api/systemLogs';

export function useSystemLogs(filters) {
  return useQuery(
    ['systemLogs', filters],
    () => fetchSystemLogs(filters),
    { keepPreviousData: true }
  );
}

export function useSystemLogDetail(id) {
  return useQuery(
    ['systemLog', id],
    () => fetchSystemLogDetail(id),
    { enabled: !!id }
  );
}

export function usePrefetchSystemLog() {
  const qc = useQueryClient();
  return (id) => {
    qc.prefetchQuery(['systemLog', id], () => fetchSystemLogDetail(id));
  };
}
