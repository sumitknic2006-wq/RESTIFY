import { useCallback, useEffect, useRef, useState } from 'react';
import analyticsApi from '../services/analyticsApi';

const methods = {
  today: analyticsApi.today,
  weekly: analyticsApi.weekly,
  monthly: analyticsApi.monthly,
  ranking: analyticsApi.ranking,
  heatmap: analyticsApi.heatmap,
};

export default function useAnalytics(period = 'today') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    const method = methods[period];
    if (!method) {
      if (currentRequestId === requestId.current) {
        setData(null);
        setError(new Error('Unsupported analytics period.'));
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await method();
      if (currentRequestId === requestId.current) setData(response?.data ?? null);
    } catch (requestError) {
      if (currentRequestId === requestId.current) {
        setData(null);
        setError(requestError);
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { data, loading, error, refetch: load };
}
