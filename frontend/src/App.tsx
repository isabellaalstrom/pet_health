import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { usePets } from './hooks/usePets';
import { useVisits } from './hooks/useVisits';
import { PetHealthAPI } from './services/petHealthApi';
import type { View, PetEntry, HomeAssistant, Visit, MedicationLog, StoreData, Medication } from './types';

interface AppProps {
  hass: HomeAssistant;
}

// Add global responsive styles
const globalStyles = `
  @media (max-width: 768px) {
    .mobile-table-row {
      display: flex !important;
      flex-direction: column !important;
      border-bottom: 2px solid #e0e0e0 !important;
      padding: 12px !important;
      gap: 8px !important;
    }

    .mobile-table-row > td {
      display: flex !important;
      justify-content: space-between !important;
      padding: 4px 0 !important;
      border: none !important;
    }

    .mobile-table-row > td::before {
      content: attr(data-label);
      font-weight: 600;
      color: #666;
      margin-right: 12px;
    }

    .mobile-hide-header thead {
      display: none !important;
    }

    .mobile-compact {
      padding: 8px 12px !important;
      font-size: 13px !important;
    }
  }
`;


const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  containerMobile: {
    padding: '12px',
  },
  header: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  headerMobile: {
    padding: '16px',
    marginBottom: '16px',
  },
  h1: {
    margin: '0 0 24px 0',
    fontSize: '32px',
    fontWeight: 700,
    color: '#212121',
  },
  h1Mobile: {
    fontSize: '24px',
    marginBottom: '16px',
  },
  petSelector: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const,
    margin: '16px 0',
    justifyContent: 'center',
  },
  petSelectorMobile: {
    gap: '10px',
    margin: '12px 0',
  },
  petButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    border: '3px solid #e0e0e0',
    borderRadius: '12px',
    background: '#ffffff',
    color: '#212121',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: '110px',
  },
  petButtonMobile: {
    padding: '10px 12px',
    gap: '6px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    minWidth: '80px',
  },
  petButtonSelected: {
    border: '3px solid #03a9f4',
    background: '#03a9f4',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(3, 169, 244, 0.3)',
    transform: 'translateY(-2px)',
  },
  petButtonSelectedMobile: {
    border: '2px solid #03a9f4',
  },
  petImage: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '3px solid #e0e0e0',
  },
  petImageMobile: {
    width: '48px',
    height: '48px',
    border: '2px solid #e0e0e0',
  },
  petImageSelected: {
    borderColor: '#ffffff',
    boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.2)',
  },
  petImageSelectedMobile: {
    boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.2)',
  },
  petName: {
    fontSize: '14px',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  petNameMobile: {
    fontSize: '12px',
  },
  navigation: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    marginBottom: '24px',
    background: '#ffffff',
    padding: '12px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  navigationMobile: {
    gap: '8px',
    padding: '8px',
    marginBottom: '16px',
  },
  navButton: {
    padding: '14px 28px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#212121',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 500,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  navButtonMobile: {
    padding: '10px 16px',
    fontSize: '13px',
  },
  navButtonActive: {
    background: '#03a9f4',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(3, 169, 244, 0.3)',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '28px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    marginBottom: '24px',
  },
  cardMobile: {
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '8px',
  },
  h2: {
    margin: '0 0 24px 0',
    fontSize: '22px',
    fontWeight: 700,
    color: '#212121',
    paddingBottom: '12px',
    borderBottom: '2px solid #e0e0e0',
  },
  h2Mobile: {
    fontSize: '18px',
    margin: '0 0 16px 0',
    paddingBottom: '8px',
  },
  h3: {
    margin: '24px 0 16px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#212121',
  },
  h3Mobile: {
    fontSize: '16px',
    margin: '16px 0 12px 0',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    margin: '24px 0',
  },
  statCard: {
    background: 'linear-gradient(135deg, #e5e5e5 0%, #ffffff 100%)',
    padding: '24px',
    borderRadius: '12px',
    textAlign: 'center' as const,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '2px solid transparent',
  },
  statLabel: {
    fontSize: '13px',
    color: '#727272',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    fontWeight: 600,
  },
  statValue: {
    fontSize: '40px',
    fontWeight: 800,
    color: '#03a9f4',
    lineHeight: 1,
  },
  actionButtons: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const,
    marginTop: '16px',
  },
  actionButtonsMobile: {
    gap: '12px',
    marginTop: '12px',
  },
  actionButton: {
    padding: '14px 32px',
    border: 'none',
    borderRadius: '8px',
    background: '#03a9f4',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 600,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(3, 169, 244, 0.2)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  actionButtonMobile: {
    padding: '12px 20px',
    fontSize: '13px',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate' as const,
    borderSpacing: 0,
    marginTop: '24px',
  },
  tableMobile: {
    marginTop: '16px',
    display: 'block',
  },
  th: {
    padding: '16px',
    textAlign: 'left' as const,
    background: '#e5e5e5',
    fontWeight: 700,
    color: '#212121',
    fontSize: '13px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '1px solid #e0e0e0',
  },
  thMobile: {
    padding: '10px',
    fontSize: '11px',
  },
  td: {
    padding: '16px',
    textAlign: 'left' as const,
    color: '#727272',
    fontSize: '14px',
    borderBottom: '1px solid #e0e0e0',
  },
  tdMobile: {
    padding: '10px',
    fontSize: '13px',
  },
  smallButton: {
    padding: '6px 10px',
    border: 'none',
    borderRadius: '6px',
    background: '#e5e5e5',
    color: '#212121',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: '32px',
  },
  smallButtonMobile: {
    padding: '8px 12px',
    fontSize: '14px',
    minWidth: '40px',
  },
  dialogOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '550px',
    width: '90%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    color: '#212121',
    fontSize: '14px',
    fontWeight: 600,
  },
  input: {
    padding: '12px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#212121',
    fontSize: '15px',
    fontFamily: 'inherit',
  },
  textarea: {
    padding: '12px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#212121',
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: '80px',
  },
  select: {
    padding: '12px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#212121',
    fontSize: '15px',
    fontFamily: 'inherit',
  },
  dialogButtons: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'flex-end' as const,
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #e0e0e0',
  },
  badge: {
    position: 'absolute' as const,
    top: '-6px',
    right: '-6px',
    background: '#f44336',
    color: '#ffffff',
    borderRadius: '50%',
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  badgeContainer: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  unconfirmedMark: {
    color: '#f44336',
    fontSize: '20px',
    fontWeight: 700,
  },
};

function App({ hass }: AppProps) {
  const api = useMemo(() => new PetHealthAPI(hass), [hass]);
  const { pets } = usePets(api);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { visits, reload: reloadVisits } = useVisits(api, selectedPetId);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Additional state for missing functionality
  const [unknownVisits, setUnknownVisits] = useState<Visit[]>([]);
  const [medications, setMedications] = useState<MedicationLog[]>([]);
  const [storeData, setStoreData] = useState<StoreData>({});
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showAmendDialog, setShowAmendDialog] = useState(false);
  const [showMedDialog, setShowMedDialog] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [logFormData, setLogFormData] = useState({
    did_pee: false,
    did_poop: false,
    consistencies: [] as string[],
    color: '',
    urine_amount: '',
    notes: '',
    timestamp: '',
    assigned_to: '',
  });
  const [medFormData, setMedFormData] = useState({
    medication_id: '',
    dosage: '',
    unit: '',
    notes: '',
    timestamp: '',
  });

  // Auto-select first pet
  useEffect(() => {
    if (pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].entry_id);
    }
  }, [pets, selectedPetId]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load store data when pet changes
  useEffect(() => {
    if (!api || !selectedPetId) return;

    const loadStoreData = async () => {
      try {
        const data = await api.getStoreDump(selectedPetId);
        setStoreData(data);
      } catch (err) {
        console.error('Failed to load store data:', err);
      }
    };

    loadStoreData();
  }, [api, selectedPetId]);

  // Load unknown visits
  useEffect(() => {
    if (!api) return;

    const loadUnknownVisits = async () => {
      try {
        const data = await api.getUnknownVisits();
        setUnknownVisits(data);
      } catch (err) {
        console.error('Failed to load unknown visits:', err);
      }
    };

    loadUnknownVisits();
  }, [api]);

  // Load medications for selected pet
  useEffect(() => {
    if (!api || !selectedPetId) {
      setMedications([]);
      return;
    }

    const loadMedications = async () => {
      try {
        const data = await api.getMedications(selectedPetId);
        setMedications(data);
      } catch (err) {
        console.error('Failed to load medications:', err);
      }
    };

    loadMedications();
  }, [api, selectedPetId]);

  // Subscribe to data updates
  useEffect(() => {
    if (!api) return;

    let unsubscribe: (() => void) | undefined;

    api.subscribeToDataUpdates(() => {
      reloadVisits();
      // Reload other data as well
      if (selectedPetId) {
        api.getStoreDump(selectedPetId).then(setStoreData).catch(console.error);
        api.getMedications(selectedPetId).then(setMedications).catch(console.error);
      }
      api.getUnknownVisits().then(setUnknownVisits).catch(console.error);
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [api, reloadVisits, selectedPetId]);

  const selectedPet = useMemo(() =>
    pets.find(p => p.entry_id === selectedPetId),
    [pets, selectedPetId]
  );

  const getPetName = (pet: PetEntry) => {
    return pet.pet_name || pet.name || pet.title || 'Unknown Pet';
  };

  // Calculate unconfirmed visits for each pet
  const getUnconfirmedCount = (petEntryId: string) => {
    const pet = pets.find(p => p.entry_id === petEntryId);
    if (!pet || !pet.pet_id) return 0;
    return visits.filter(v => v.pet_id === pet.pet_id && !v.confirmed).length;
  };

  const hasAlerts = (petEntryId: string) => {
    return getUnconfirmedCount(petEntryId) > 0;
  };

  const totalUnconfirmedVisits = visits.filter(v => !v.confirmed).length;

  const getPetImageUrl = (pet: PetEntry) => {
    if (pet.pet_image_path) {
      return pet.pet_image_path;
    }
    const petType = pet.pet_type || 'other';
    return `/pet_health_panel/default-${petType}.svg`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (isToday) {
      return timeStr;
    }

    const dateStr = date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
    return `${dateStr} ${timeStr}`;
  };

  const handleLogVisit = () => {
    setLogFormData({
      did_pee: false,
      did_poop: false,
      consistencies: [],
      color: '',
      urine_amount: '',
      notes: '',
      timestamp: '',
      assigned_to: '',
    });
    setShowLogDialog(true);
  };

  const submitLogVisit = async () => {
    if (!api || !selectedPetId) return;

    try {
      const serviceData: any = {
        config_entry_id: selectedPetId,
        did_pee: logFormData.did_pee,
        did_poop: logFormData.did_poop,
        confirmed: true,
      };

      // Only add fields if they have values
      if (logFormData.consistencies.length > 0) {
        serviceData.poop_consistencies = logFormData.consistencies;
      }
      if (logFormData.color) {
        serviceData.poop_color = logFormData.color;
      }
      if (logFormData.urine_amount) {
        serviceData.urine_amount = logFormData.urine_amount;
      }
      if (logFormData.notes) {
        serviceData.notes = logFormData.notes;
      }
      if (logFormData.timestamp) {
        serviceData.logged_at = new Date(logFormData.timestamp).toISOString();
      }

      await api.logBathroomVisit(serviceData);
      setShowLogDialog(false);
      reloadVisits();
    } catch (err) {
      console.error('Failed to log visit:', err);
      alert('Failed to log visit: ' + (err as Error).message);
    }
  };

  const handleConfirmVisit = async (visitId: string) => {
    if (!api || !selectedPetId) return;

    try {
      await api.confirmVisit(visitId);
      reloadVisits();
    } catch (err) {
      console.error('Failed to confirm visit:', err);
      alert('Failed to confirm visit: ' + (err as Error).message);
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (!api || !selectedPetId) return;
    if (!confirm('Are you sure you want to delete this visit?')) return;

    try {
      await api.deleteVisit(visitId);
      reloadVisits();
    } catch (err) {
      console.error('Failed to delete visit:', err);
      alert('Failed to delete visit: ' + (err as Error).message);
    }
  };

  const handleAmendVisit = (visit: Visit) => {
    setEditingVisit(visit);
    setLogFormData({
      did_pee: visit.did_pee || false,
      did_poop: visit.did_poop || false,
      consistencies: Array.isArray(visit.poop_consistencies)
        ? visit.poop_consistencies
        : (visit.poop_consistencies ? [visit.poop_consistencies] : []),
      color: visit.poop_color || '',
      urine_amount: visit.urine_amount?.toString() || '',
      notes: visit.notes || '',
      timestamp: '',
      assigned_to: selectedPetId || '',
    });
    setShowAmendDialog(true);
  };

  const submitAmendVisit = async () => {
    if (!api || !selectedPetId || !editingVisit) return;

    try {
      const amendData: any = {
        did_pee: logFormData.did_pee,
        did_poop: logFormData.did_poop,
      };

      // Only add fields if they have values
      if (logFormData.consistencies.length > 0) {
        amendData.poop_consistencies = logFormData.consistencies;
      }
      if (logFormData.color) {
        amendData.poop_color = logFormData.color;
      }
      if (logFormData.urine_amount) {
        amendData.urine_amount = logFormData.urine_amount;
      }
      if (logFormData.notes) {
        amendData.notes = logFormData.notes;
      }

      await api.amendVisit(editingVisit.visit_id, amendData);

      // Handle reassignment if pet was changed
      if (logFormData.assigned_to && logFormData.assigned_to !== selectedPetId) {
        await api.reassignVisit(editingVisit.visit_id, logFormData.assigned_to);
      }

      setShowAmendDialog(false);
      setEditingVisit(null);
      reloadVisits();
    } catch (err) {
      console.error('Failed to amend visit:', err);
      alert('Failed to amend visit: ' + (err as Error).message);
    }
  };

  const handleReassignVisit = async (visitId: string, newEntryId: string) => {
    if (!api) return;

    try {
      await api.reassignVisit(visitId, newEntryId);
      reloadVisits();
    } catch (err) {
      console.error('Failed to reassign visit:', err);
      alert('Failed to reassign visit: ' + (err as Error).message);
    }
  };

  const handleLogMedication = () => {
    setMedFormData({
      medication_id: '',
      dosage: '',
      unit: '',
      notes: '',
      timestamp: '',
    });
    setShowMedDialog(true);
  };

  const submitLogMedication = async () => {
    if (!api || !selectedPetId || !medFormData.medication_id) {
      alert('Please select a medication');
      return;
    }

    try {
      const serviceData: any = {
        config_entry_id: selectedPetId,
        medication_id: medFormData.medication_id,
        dosage: medFormData.dosage || undefined,
        unit: medFormData.unit || undefined,
        notes: medFormData.notes || undefined,
      };
      if (medFormData.timestamp) {
        serviceData.given_at = new Date(medFormData.timestamp).toISOString();
      }
      await api.logMedication(serviceData);
      setShowMedDialog(false);
      if (selectedPetId) {
        api.getMedications(selectedPetId).then(setMedications).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to log medication:', err);
      alert('Failed to log medication: ' + (err as Error).message);
    }
  };

  // Helper to merge mobile styles
  const s = (key: string) => {
    const mobileKey = `${key}Mobile`;
    return isMobile && styles[mobileKey]
      ? { ...styles[key], ...styles[mobileKey] }
      : styles[key];
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div style={{...styles.container, ...(isMobile ? styles.containerMobile : {})}}>
        <div style={{...styles.header, ...(isMobile ? styles.headerMobile : {})}}>
          <h1 style={{...styles.h1, ...(isMobile ? styles.h1Mobile : {})}}>🐾 Pet Health</h1>

          <div style={{...styles.petSelector, ...(isMobile ? styles.petSelectorMobile : {})}}>
            {pets.map(pet => (
              <div key={pet.entry_id} style={styles.badgeContainer}>
                <button
                  style={pet.entry_id === selectedPetId
                    ? {...s('petButton'), ...s('petButtonSelected')}
                    : s('petButton')}
                  onClick={() => setSelectedPetId(pet.entry_id)}
                >
                  <img
                    src={getPetImageUrl(pet)}
                    alt={getPetName(pet)}
                    style={pet.entry_id === selectedPetId
                      ? {...s('petImage'), ...s('petImageSelected')}
                      : s('petImage')}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/pet_health_panel/default-other.svg';
                    }}
                  />
                  <span style={s('petName')}>{getPetName(pet)}</span>
                </button>
              {hasAlerts(pet.entry_id) && (
                <div style={styles.badge}>!</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{...styles.navigation, ...(isMobile ? styles.navigationMobile : {})}}>
        <button
          style={currentView === 'dashboard'
            ? {...s('navButton'), ...styles.navButtonActive}
            : s('navButton')}
          onClick={() => setCurrentView('dashboard')}
        >
          Dashboard
        </button>
        <div style={styles.badgeContainer}>
          <button
            style={currentView === 'visits'
              ? {...s('navButton'), ...styles.navButtonActive}
              : s('navButton')}
            onClick={() => setCurrentView('visits')}
          >
            Bathroom Visits
          </button>
          {(totalUnconfirmedVisits > 0 || unknownVisits.length > 0) && (
            <div style={styles.badge}>
              {totalUnconfirmedVisits + unknownVisits.length}
            </div>
          )}
        </div>
        <button
          style={currentView === 'medications'
            ? {...s('navButton'), ...styles.navButtonActive}
            : s('navButton')}
          onClick={() => setCurrentView('medications')}
        >
          Medications
        </button>
        <button
          style={currentView === 'health'
            ? {...s('navButton'), ...styles.navButtonActive}
            : s('navButton')}
          onClick={() => setCurrentView('health')}
        >
          Health
        </button>
        <button
          style={currentView === 'nutrition'
            ? {...s('navButton'), ...styles.navButtonActive}
            : s('navButton')}
          onClick={() => setCurrentView('nutrition')}
        >
          Nutrition
        </button>
      </div>

      {currentView === 'dashboard' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: isMobile ? "16px" : "24px"}}>
          <div style={s('card')}>
            <h2 style={s('h2')}>Dashboard for {getPetName(selectedPet)}</h2>
            <div style={styles.stats}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Visits</div>
                <div style={styles.statValue}>{visits.length}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Today's Visits</div>
                <div style={styles.statValue}>
                  {visits.filter(v => {
                    const visitDate = new Date(v.timestamp);
                    const today = new Date();
                    return visitDate.toDateString() === today.toDateString();
                  }).length}
                </div>
              </div>
              {unknownVisits.length > 0 && (
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Unknown Visits</div>
                  <div style={styles.statValue}>{unknownVisits.length}</div>
                </div>
              )}
            </div>
            <div style={s('actionButtons')}>
              <button style={s('actionButton')} onClick={handleLogVisit}>
                Log Bathroom Visit
              </button>
              <button style={s('actionButton')} onClick={handleLogMedication}>
                Log Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'visits' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: isMobile ? "16px" : "24px"}}>
          {unknownVisits.length > 0 && (
            <div style={s('card')}>
              <h2 style={s('h2')}>⚠️ Unknown Visits (Need Assignment)</h2>
              <div style={{marginTop: isMobile ? "16px" : "24px", overflowX: "auto"}}>
                <table style={s('table')} className={isMobile ? "mobile-hide-header" : ""}>
                  <thead>
                    <tr>
                      <th style={s('th')}>Time</th>
                      <th style={s('th')}>Pee</th>
                      <th style={s('th')}>Poop</th>
                      <th style={s('th')}>Notes</th>
                      <th style={s('th')}>Assign To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unknownVisits.map(visit => (
                      <tr key={visit.visit_id} style={{background: '#fff3e0'}} className={isMobile ? "mobile-table-row" : ""}>
                        <td style={s('td')} data-label="Time">{formatTimestamp(visit.timestamp)}</td>
                        <td style={s('td')} data-label="Pee">{visit.did_pee ? '✓' : ''}</td>
                        <td style={s('td')} data-label="Poop">{visit.did_poop ? '✓' : ''}</td>
                        <td style={s('td')} data-label="Notes">{visit.notes || ''}</td>
                        <td style={s('td')} data-label="Assign To">
                          <select
                            style={{padding: isMobile ? '10px' : '8px', borderRadius: '6px', border: '2px solid #ff9800', width: isMobile ? '100%' : 'auto'}}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleReassignVisit(visit.visit_id, e.target.value);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">Select pet...</option>
                            {pets.map(pet => (
                              <option key={pet.entry_id} value={pet.entry_id}>
                                {getPetName(pet)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={s('card')}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '16px' : '24px', flexWrap: 'wrap', gap: '12px'}}>
              <h2 style={{...s('h2'), margin: 0, border: 'none', paddingBottom: 0}}>Bathroom Visits for {getPetName(selectedPet)}</h2>
              {visits.filter(v => !v.confirmed).length > 0 && (
                <div style={{color: '#f44336', fontWeight: 600, fontSize: isMobile ? '12px' : '14px'}}>
                  {visits.filter(v => !v.confirmed).length} unconfirmed
                </div>
              )}
            </div>
            <button style={s('actionButton')} onClick={handleLogVisit}>
              Log New Visit
            </button>

            {visits.length === 0 ? (
              <p>No visits recorded yet.</p>
            ) : (
              <div style={{marginTop: isMobile ? "16px" : "24px", overflowX: "auto"}}>
                <table style={s('table')} className={isMobile ? "mobile-hide-header" : ""}>
                  <thead>
                    <tr>
                      <th style={s('th')}>Time</th>
                      <th style={s('th')}>Pee</th>
                      <th style={s('th')}>Poop</th>
                      <th style={s('th')}>Consistency</th>
                      <th style={s('th')}>Color</th>
                      <th style={s('th')}>Urine Amount</th>
                      <th style={s('th')}>Notes</th>
                      <th style={s('th')}>Confirmed</th>
                      <th style={s('th')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 50).map(visit => (
                      <tr key={visit.visit_id} style={!visit.confirmed ? {background: '#ffebee'} : undefined} className={isMobile ? "mobile-table-row" : ""}>
                        <td style={s('td')} data-label="Time">{formatTimestamp(visit.timestamp)}</td>
                        <td style={s('td')} data-label="Pee">{visit.did_pee ? '✓' : ''}</td>
                        <td style={s('td')} data-label="Poop">{visit.did_poop ? '✓' : ''}</td>
                        <td style={s('td')} data-label="Consistency">{visit.poop_consistencies || ''}</td>
                        <td style={s('td')} data-label="Color">{visit.poop_color || ''}</td>
                        <td style={s('td')} data-label="Urine Amount">{visit.urine_amount || ''}</td>
                        <td style={s('td')} data-label="Notes">{visit.notes || ''}</td>
                        <td style={s('td')} data-label="Confirmed">
                          {visit.confirmed ? '✓' : <span style={styles.unconfirmedMark}>?</span>}
                        </td>
                        <td style={s('td')} data-label="Actions">
                          <div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
                            <div style={{display: "flex", gap: "6px", flexWrap: "wrap"}}>
                              {!visit.confirmed && (
                                <button
                                  style={s('smallButton')}
                                  onClick={() => handleConfirmVisit(visit.visit_id)}
                                  title="Confirm"
                                >
                                  ✓
                                </button>
                              )}
                              <button
                                style={s('smallButton')}
                                onClick={() => handleAmendVisit(visit)}
                                title="Amend"
                              >
                                ✏️
                              </button>
                              <button
                                style={s('smallButton')}
                                onClick={() => handleDeleteVisit(visit.visit_id)}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                            {!visit.confirmed && (
                              <select
                                style={{padding: isMobile ? '8px' : '6px', borderRadius: '4px', border: '2px solid #f44336', fontSize: isMobile ? '13px' : '12px', width: isMobile ? '100%' : 'auto'}}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleReassignVisit(visit.visit_id, e.target.value);
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="">Reassign...</option>
                                {pets.filter(p => p.entry_id !== selectedPetId).map(pet => (
                                  <option key={pet.entry_id} value={pet.entry_id}>
                                    {getPetName(pet)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'medications' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
          <div style={styles.card}>
            <h2 style={styles.h2}>Medications for {getPetName(selectedPet)}</h2>
            <button style={styles.actionButton} onClick={handleLogMedication}>
              Log Medication
            </button>

            {medications.length === 0 ? (
              <p>No medications logged yet.</p>
            ) : (
              <div style={{marginTop: "24px", overflowX: "auto"}}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Time</th>
                      <th style={styles.th}>Medication</th>
                      <th style={styles.th}>Dosage</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.slice(0, 50).map((med, idx) => (
                      <tr key={`${med.medication_name}-${med.timestamp}-${idx}`}>
                        <td style={styles.td}>{formatTimestamp(med.timestamp)}</td>
                        <td style={styles.td}>{med.medication_name}</td>
                        <td style={styles.td}>{med.dosage || ''}</td>
                        <td style={styles.td}>{med.unit || ''}</td>
                        <td style={styles.td}>{med.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'health' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
          {/* Wellbeing */}
          {storeData.wellbeing && storeData.wellbeing.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Wellbeing Assessments</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Score</th>
                    <th style={styles.th}>Symptoms</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.wellbeing.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{record.wellbeing_score}</td>
                      <td style={styles.td}>{record.symptoms?.join(', ') || '-'}</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Thirst Levels */}
          {storeData.thirst_levels && storeData.thirst_levels.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Thirst Levels</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Level</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.thirst_levels.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{record.level}</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Appetite Levels */}
          {storeData.appetite_levels && storeData.appetite_levels.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Appetite Levels</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Level</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.appetite_levels.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{record.level}</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Weight History */}
          {storeData.weight && storeData.weight.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Weight History</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Weight</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.weight.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{(record.weight_grams / 1000).toFixed(2)} kg</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vomit Records */}
          {storeData.vomit && storeData.vomit.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Vomit Records</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.vomit.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{record.vomit_type}</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!storeData.wellbeing?.length && !storeData.thirst_levels?.length &&
           !storeData.appetite_levels?.length && !storeData.weight?.length &&
           !storeData.vomit?.length && (
            <div style={styles.card}>
              <p>No health data recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {currentView === 'nutrition' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
          {/* Meals */}
          {storeData.meals && storeData.meals.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Meals</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Food Type</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.meals.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{record.amount}</td>
                      <td style={styles.td}>{record.food_type || '-'}</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Drinks */}
          {storeData.drinks && storeData.drinks.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.h3}>Drinks</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {storeData.drinks.map((record: any, idx: number) => (
                    <tr key={idx} style={idx % 2 === 0 ? styles.tr : {...styles.tr, background: '#f9fafb'}}>
                      <td style={styles.td}>{formatTimestamp(record.timestamp)}</td>
                      <td style={styles.td}>{record.amount}</td>
                      <td style={styles.td}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!storeData.meals?.length && !storeData.drinks?.length && (
            <div style={styles.card}>
              <p>No nutrition data recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Log Visit Dialog */}
      {showLogDialog && (
        <div style={styles.dialogOverlay} onClick={() => setShowLogDialog(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>Log Bathroom Visit</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={logFormData.did_pee}
                  onChange={(e) => setLogFormData({...logFormData, did_pee: e.target.checked})}
                />
                Did Pee
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={logFormData.did_poop}
                  onChange={(e) => setLogFormData({...logFormData, did_poop: e.target.checked})}
                />
                Did Poop
              </label>
            </div>
            {logFormData.did_poop && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Consistency (click to add in order):
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px'}}>
                      {['constipated', 'hard', 'normal', 'soft', 'diarrhea'].map(consistency => (
                        <button
                          key={consistency}
                          type="button"
                          onClick={() => setLogFormData({...logFormData, consistencies: [...logFormData.consistencies, consistency]})}
                          style={{
                            padding: '6px 12px',
                            fontSize: '14px',
                            backgroundColor: '#03a9f4',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {consistency.charAt(0).toUpperCase() + consistency.slice(1)}
                        </button>
                      ))}
                    </div>
                    {logFormData.consistencies.length > 0 && (
                      <div style={{marginTop: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                        <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Sequence:</div>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                          {logFormData.consistencies.map((c, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                              }}
                            >
                              <span>{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                              <button
                                type="button"
                                onClick={() => setLogFormData({...logFormData, consistencies: logFormData.consistencies.filter((_, i) => i !== idx)})}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#f44336',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  lineHeight: '1',
                                  padding: '0 2px'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Color:
                    <select
                      style={styles.select}
                      value={logFormData.color}
                      onChange={(e) => setLogFormData({...logFormData, color: e.target.value})}
                    >
                      <option value="">Select...</option>
                      <option value="brown">Brown</option>
                      <option value="dark_brown">Dark Brown</option>
                      <option value="light_brown">Light Brown</option>
                      <option value="yellow">Yellow</option>
                      <option value="green">Green</option>
                      <option value="black">Black</option>
                      <option value="red">Red</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {logFormData.did_pee && (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Urine Amount:
                  <select
                    style={styles.select}
                    value={logFormData.urine_amount}
                    onChange={(e) => setLogFormData({...logFormData, urine_amount: e.target.value})}
                  >
                    <option value="">Select...</option>
                    <option value="normal">Normal</option>
                    <option value="more_than_usual">More than usual</option>
                    <option value="less_than_usual">Less than usual</option>
                  </select>
                </label>
              </div>
            )}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Notes:
                <textarea
                  value={logFormData.notes}
                  onChange={(e) => setLogFormData({...logFormData, notes: e.target.value})}
                  rows={3}
                />
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Time (leave empty for now):
                <input
                  type="datetime-local"
                  value={logFormData.timestamp}
                  onChange={(e) => setLogFormData({...logFormData, timestamp: e.target.value})}
                />
              </label>
            </div>
            <div style={styles.dialogButtons}>
              <button style={styles.actionButton} onClick={submitLogVisit}>Submit</button>
              <button style={styles.actionButton} onClick={() => setShowLogDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Amend Visit Dialog */}
      {showAmendDialog && editingVisit && (
        <div style={styles.dialogOverlay} onClick={() => setShowAmendDialog(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>Amend Visit</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={logFormData.did_pee}
                  onChange={(e) => setLogFormData({...logFormData, did_pee: e.target.checked})}
                />
                Did Pee
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={logFormData.did_poop}
                  onChange={(e) => setLogFormData({...logFormData, did_poop: e.target.checked})}
                />
                Did Poop
              </label>
            </div>
            {logFormData.did_poop && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Consistency (click to add in order):
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px'}}>
                      {['constipated', 'hard', 'normal', 'soft', 'diarrhea'].map(consistency => (
                        <button
                          key={consistency}
                          type="button"
                          onClick={() => setLogFormData({...logFormData, consistencies: [...logFormData.consistencies, consistency]})}
                          style={{
                            padding: '6px 12px',
                            fontSize: '14px',
                            backgroundColor: '#03a9f4',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {consistency.charAt(0).toUpperCase() + consistency.slice(1)}
                        </button>
                      ))}
                    </div>
                    {logFormData.consistencies.length > 0 && (
                      <div style={{marginTop: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                        <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Sequence:</div>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                          {logFormData.consistencies.map((c, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px'
                              }}
                            >
                              <span>{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                              <button
                                type="button"
                                onClick={() => setLogFormData({...logFormData, consistencies: logFormData.consistencies.filter((_, i) => i !== idx)})}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#f44336',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  lineHeight: '1',
                                  padding: '0 2px'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Color:
                    <select
                      style={styles.select}
                      value={logFormData.color}
                      onChange={(e) => setLogFormData({...logFormData, color: e.target.value})}
                    >
                      <option value="">Select...</option>
                      <option value="brown">Brown</option>
                      <option value="dark_brown">Dark Brown</option>
                      <option value="light_brown">Light Brown</option>
                      <option value="yellow">Yellow</option>
                      <option value="green">Green</option>
                      <option value="black">Black</option>
                      <option value="red">Red</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {logFormData.did_pee && (
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Urine Amount:
                  <select
                    style={styles.select}
                    value={logFormData.urine_amount}
                    onChange={(e) => setLogFormData({...logFormData, urine_amount: e.target.value})}
                  >
                    <option value="">Select...</option>
                    <option value="normal">Normal</option>
                    <option value="more_than_usual">More than usual</option>
                    <option value="less_than_usual">Less than usual</option>
                  </select>
                </label>
              </div>
            )}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Notes:
                <textarea
                  value={logFormData.notes}
                  onChange={(e) => setLogFormData({...logFormData, notes: e.target.value})}
                  rows={3}
                />
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Reassign to:
                <select
                  style={styles.select}
                  value={logFormData.assigned_to}
                  onChange={(e) => setLogFormData({...logFormData, assigned_to: e.target.value})}
                >
                  {pets.map(pet => (
                    <option key={pet.entry_id} value={pet.entry_id}>
                      {getPetName(pet)}{pet.entry_id === selectedPetId ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={styles.dialogButtons}>
              <button style={styles.actionButton} onClick={submitAmendVisit}>Submit</button>
              <button style={styles.actionButton} onClick={() => setShowAmendDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Medication Dialog */}
      {showMedDialog && (
        <div style={styles.dialogOverlay} onClick={() => setShowMedDialog(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>Log Medication</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Medication:
                <select
                  value={medFormData.medication_id}
                  onChange={(e) => setMedFormData({...medFormData, medication_id: e.target.value})}
                >
                  <option value="">Select medication...</option>
                  {selectedPet?.medications?.map((med: Medication) => (
                    <option key={med.medication_id} value={med.medication_id}>
                      {med.medication_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Dosage:
                <input
                  type="text"
                  value={medFormData.dosage}
                  onChange={(e) => setMedFormData({...medFormData, dosage: e.target.value})}
                />
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Unit:
                <input
                  type="text"
                  value={medFormData.unit}
                  onChange={(e) => setMedFormData({...medFormData, unit: e.target.value})}
                />
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Notes:
                <textarea
                  value={medFormData.notes}
                  onChange={(e) => setMedFormData({...medFormData, notes: e.target.value})}
                  rows={3}
                />
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Time (leave empty for now):
                <input
                  type="datetime-local"
                  value={medFormData.timestamp}
                  onChange={(e) => setMedFormData({...medFormData, timestamp: e.target.value})}
                />
              </label>
            </div>
            <div style={styles.dialogButtons}>
              <button style={styles.actionButton} onClick={submitLogMedication}>Submit</button>
              <button style={styles.actionButton} onClick={() => setShowMedDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default App;
