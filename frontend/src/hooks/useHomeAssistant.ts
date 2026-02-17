import { useEffect, useState } from 'react';
import type { HomeAssistant } from '../types';
import { PetHealthAPI } from '../services/petHealthApi';

export function useHomeAssistant(): { hass: HomeAssistant | null; api: PetHealthAPI | null } {
  const [hass, setHass] = useState<HomeAssistant | null>(null);
  const [api, setApi] = useState<PetHealthAPI | null>(null);

  useEffect(() => {
    // Home Assistant provides the panel with hass through custom elements
    const checkHass = () => {
      const panelElement = document.querySelector('pet-health-panel');
      if (panelElement && (panelElement as any).hass) {
        const hassInstance = (panelElement as any).hass;
        setHass(hassInstance);
        setApi(new PetHealthAPI(hassInstance));
      }
    };

    checkHass();
    const interval = setInterval(checkHass, 100);

    return () => clearInterval(interval);
  }, []);

  return { hass, api };
}
