import { useEffect, useState } from 'react';
import type { HomeAssistant } from '../types';
import { PetHealthAPI } from '../services/petHealthApi';

export function useHomeAssistant(): { hass: HomeAssistant | null; api: PetHealthAPI | null } {
  const [hass, setHass] = useState<HomeAssistant | null>(null);
  const [api, setApi] = useState<PetHealthAPI | null>(null);

  useEffect(() => {
    // First check if hass is already available
    const panelElement = document.querySelector('pet-health-panel');
    if (panelElement && (panelElement as any).hass) {
      const hassInstance = (panelElement as any).hass;
      setHass(hassInstance);
      setApi(new PetHealthAPI(hassInstance));
      return;
    }

    // Use MutationObserver to detect when the element or hass becomes available
    const observer = new MutationObserver(() => {
      const element = document.querySelector('pet-health-panel');
      if (element && (element as any).hass) {
        const hassInstance = (element as any).hass;
        setHass(hassInstance);
        setApi(new PetHealthAPI(hassInstance));
        observer.disconnect();
      }
    });

    // Observe the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hass'],
    });

    // Cleanup
    return () => observer.disconnect();
  }, []);

  return { hass, api };
}
