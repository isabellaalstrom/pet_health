import { useEffect, useState, useCallback } from 'react';
import type { Visit } from '../types';
import type { PetHealthAPI } from '../services/petHealthApi';

export function useVisits(api: PetHealthAPI | null, entryId: string | null) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadVisits = useCallback(async () => {
    if (!api || !entryId) {
      setVisits([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.getVisits(entryId);
      setVisits(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load visits:', err);
    } finally {
      setLoading(false);
    }
  }, [api, entryId]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  return { visits, loading, error, reload: loadVisits };
}
