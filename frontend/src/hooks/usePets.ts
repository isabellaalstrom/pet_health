import { useEffect, useState, useCallback } from 'react';
import type { PetEntry } from '../types';
import type { PetHealthAPI } from '../services/petHealthApi';

export function usePets(api: PetHealthAPI | null) {
  const [pets, setPets] = useState<PetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadPets = useCallback(async () => {
    if (!api) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.getPetData();
      setPets(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load pets:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  return { pets, loading, error, reload: loadPets };
}
