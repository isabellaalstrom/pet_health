import { useEffect, useState } from 'react';
import type { HomeAssistant } from '../types';
import { PetHealthAPI } from '../services/petHealthApi';

export function useHomeAssistant(): { hass: HomeAssistant | null; api: PetHealthAPI | null } {
  const [hass, setHass] = useState<HomeAssistant | null>(null);
  const [api, setApi] = useState<PetHealthAPI | null>(null);

  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 50; // Check for 5 seconds max (50 * 100ms)
    
    const checkHass = () => {
      const panelElement = document.querySelector('pet-health-panel');
      if (panelElement && (panelElement as any).hass) {
        const hassInstance = (panelElement as any).hass;
        setHass(hassInstance);
        setApi(new PetHealthAPI(hassInstance));
        return true;
      }
      return false;
    };

    // First immediate check
    if (checkHass()) {
      return;
    }

    // Poll with a reasonable limit and backoff
    const interval = setInterval(() => {
      checkCount++;
      if (checkHass() || checkCount >= maxChecks) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return { hass, api };
}
