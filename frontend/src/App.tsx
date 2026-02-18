import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { usePets } from './hooks/usePets';
import { useVisits } from './hooks/useVisits';
import { PetHealthAPI } from './services/petHealthApi';
import type { View, PetEntry, HomeAssistant, Visit, MedicationLog, StoreData, Medication } from './types';

interface AppProps {
  hass: HomeAssistant;
}

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  h1: {
    margin: '0 0 24px 0',
    fontSize: '32px',
    fontWeight: 700,
    color: '#212121',
  },
  petSelector: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const,
    margin: '16px 0',
    justifyContent: 'center',
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
  petButtonSelected: {
    border: '3px solid #03a9f4',
    background: '#03a9f4',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(3, 169, 244, 0.3)',
    transform: 'translateY(-2px)',
  },
  petImage: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '3px solid #e0e0e0',
  },
  petImageSelected: {
    borderColor: '#ffffff',
    boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.2)',
  },
  petName: {
    fontSize: '14px',
    fontWeight: 600,
    textAlign: 'center' as const,
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
  h2: {
    margin: '0 0 24px 0',
    fontSize: '22px',
    fontWeight: 700,
    color: '#212121',
    paddingBottom: '12px',
    borderBottom: '2px solid #e0e0e0',
  },
  h3: {
    margin: '24px 0 16px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#212121',
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
  table: {
    width: '100%',
    borderCollapse: 'separate' as const,
    borderSpacing: 0,
    marginTop: '24px',
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
  td: {
    padding: '16px',
    textAlign: 'left' as const,
    color: '#727272',
    fontSize: '14px',
    borderBottom: '1px solid #e0e0e0',
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
    marginRight: '6px',
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
};

function App({ hass }: AppProps) {
  const api = useMemo(() => new PetHealthAPI(hass), [hass]);
  const { pets } = usePets(api);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { visits, reload: reloadVisits } = useVisits(api, selectedPetId);

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
    consistency: '',
    color: '',
    urine_amount: '',
    notes: '',
  });
  const [medFormData, setMedFormData] = useState({
    medication_id: '',
    dosage: '',
    unit: '',
    notes: '',
  });

  // Auto-select first pet
  useEffect(() => {
    if (pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].entry_id);
    }
  }, [pets, selectedPetId]);

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

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return timeStr;
    }

    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr} ${timeStr}`;
  };

  const handleLogVisit = () => {
    setLogFormData({
      did_pee: false,
      did_poop: false,
      consistency: '',
      color: '',
      urine_amount: '',
      notes: '',
    });
    setShowLogDialog(true);
  };

  const submitLogVisit = async () => {
    if (!api || !selectedPetId) return;

    try {
      await api.logBathroomVisit({
        config_entry_id: selectedPetId,
        did_pee: logFormData.did_pee,
        did_poop: logFormData.did_poop,
        consistency: logFormData.consistency || undefined,
        color: logFormData.color || undefined,
        urine_amount: logFormData.urine_amount ? Number(logFormData.urine_amount) : undefined,
        notes: logFormData.notes || undefined,
        confirmed: true,
      });
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
      await api.confirmVisit(visitId, selectedPetId);
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
      await api.deleteVisit(visitId, selectedPetId);
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
      consistency: visit.poop_consistencies || '',
      color: visit.poop_color || '',
      urine_amount: visit.urine_amount?.toString() || '',
      notes: visit.notes || '',
    });
    setShowAmendDialog(true);
  };

  const submitAmendVisit = async () => {
    if (!api || !selectedPetId || !editingVisit) return;

    try {
      await api.amendVisit(editingVisit.visit_id, selectedPetId, {
        did_pee: logFormData.did_pee,
        did_poop: logFormData.did_poop,
        consistency: logFormData.consistency || undefined,
        color: logFormData.color || undefined,
        urine_amount: logFormData.urine_amount ? Number(logFormData.urine_amount) : undefined,
        notes: logFormData.notes || undefined,
      });
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
    });
    setShowMedDialog(true);
  };

  const submitLogMedication = async () => {
    if (!api || !selectedPetId || !medFormData.medication_id) {
      alert('Please select a medication');
      return;
    }

    try {
      await api.logMedication({
        config_entry_id: selectedPetId,
        medication_id: medFormData.medication_id,
        dosage: medFormData.dosage || undefined,
        unit: medFormData.unit || undefined,
        notes: medFormData.notes || undefined,
      });
      setShowMedDialog(false);
      if (selectedPetId) {
        api.getMedications(selectedPetId).then(setMedications).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to log medication:', err);
      alert('Failed to log medication: ' + (err as Error).message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.h1}>🐾 Pet Health</h1>

        <div style={styles.petSelector}>
          {pets.map(pet => (
            <button
              key={pet.entry_id}
              style={pet.entry_id === selectedPetId ? {...styles.petButton, ...styles.petButtonSelected} : styles.petButton}
              onClick={() => setSelectedPetId(pet.entry_id)}
            >
              <img
                src={getPetImageUrl(pet)}
                alt={getPetName(pet)}
                style={pet.entry_id === selectedPetId ? {...styles.petImage, ...styles.petImageSelected} : styles.petImage}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/pet_health_panel/default-other.svg';
                }}
              />
              <span style={styles.petName}>{getPetName(pet)}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.navigation}>
        <button
          style={currentView === 'dashboard' ? {...styles.navButton, ...styles.navButtonActive} : styles.navButton}
          onClick={() => setCurrentView('dashboard')}
        >
          Dashboard
        </button>
        <button
          style={currentView === 'visits' ? {...styles.navButton, ...styles.navButtonActive} : styles.navButton}
          onClick={() => setCurrentView('visits')}
        >
          Bathroom Visits
        </button>
        <button
          style={currentView === 'medications' ? {...styles.navButton, ...styles.navButtonActive} : styles.navButton}
          onClick={() => setCurrentView('medications')}
        >
          Medications
        </button>
        <button
          style={currentView === 'health' ? {...styles.navButton, ...styles.navButtonActive} : styles.navButton}
          onClick={() => setCurrentView('health')}
        >
          Health
        </button>
        <button
          style={currentView === 'nutrition' ? {...styles.navButton, ...styles.navButtonActive} : styles.navButton}
          onClick={() => setCurrentView('nutrition')}
        >
          Nutrition
        </button>
      </div>

      {currentView === 'dashboard' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
          <div style={styles.card}>
            <h2 style={styles.h2}>Dashboard for {getPetName(selectedPet)}</h2>
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
            <div style={styles.actionButtons}>
              <button style={styles.actionButton} onClick={handleLogVisit}>
                Log Bathroom Visit
              </button>
              <button style={styles.actionButton} onClick={handleLogMedication}>
                Log Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'visits' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
          <div style={styles.card}>
            <h2 style={styles.h2}>Bathroom Visits for {getPetName(selectedPet)}</h2>
            <button style={styles.actionButton} onClick={handleLogVisit}>
              Log New Visit
            </button>

            {visits.length === 0 ? (
              <p>No visits recorded yet.</p>
            ) : (
              <div style={{marginTop: "24px", overflowX: "auto"}}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Time</th>
                      <th style={styles.th}>Pee</th>
                      <th style={styles.th}>Poop</th>
                      <th style={styles.th}>Consistency</th>
                      <th style={styles.th}>Color</th>
                      <th style={styles.th}>Urine Amount</th>
                      <th style={styles.th}>Notes</th>
                      <th style={styles.th}>Confirmed</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 50).map(visit => (
                      <tr key={visit.visit_id}>
                        <td style={styles.td}>{formatTimestamp(visit.timestamp)}</td>
                        <td style={styles.td}>{visit.did_pee ? '✓' : ''}</td>
                        <td style={styles.td}>{visit.did_poop ? '✓' : ''}</td>
                        <td style={styles.td}>{visit.poop_consistencies || ''}</td>
                        <td style={styles.td}>{visit.poop_color || ''}</td>
                        <td style={styles.td}>{visit.urine_amount || ''}</td>
                        <td style={styles.td}>{visit.notes || ''}</td>
                        <td style={styles.td}>{visit.confirmed ? '✓' : '?'}</td>
                        <td style={styles.td}>
                          <div style={{display: "flex", gap: "6px"}}>
                            {!visit.confirmed && (
                              <button
                                style={styles.smallButton}
                                onClick={() => handleConfirmVisit(visit.visit_id)}
                                title="Confirm"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              style={styles.smallButton}
                              onClick={() => handleAmendVisit(visit)}
                              title="Amend"
                            >
                              ✏️
                            </button>
                            <button
                              style={styles.smallButton}
                              onClick={() => handleDeleteVisit(visit.visit_id)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {unknownVisits.length > 0 && (
              <>
                <h3 style={styles.h3}>Unknown Visits (Need Assignment)</h3>
                <div style={{marginTop: "24px", overflowX: "auto"}}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Time</th>
                        <th style={styles.th}>Pee</th>
                        <th style={styles.th}>Poop</th>
                        <th style={styles.th}>Notes</th>
                        <th style={styles.th}>Assign To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unknownVisits.map(visit => (
                        <tr key={visit.visit_id}>
                          <td style={styles.td}>{formatTimestamp(visit.timestamp)}</td>
                          <td style={styles.td}>{visit.did_pee ? '✓' : ''}</td>
                          <td style={styles.td}>{visit.did_poop ? '✓' : ''}</td>
                          <td style={styles.td}>{visit.notes || ''}</td>
                          <td style={styles.td}>
                            <select
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
              </>
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
          <div style={styles.card}>
            <h2 style={styles.h2}>Health Tracking for {getPetName(selectedPet)}</h2>
            {storeData.weights && storeData.weights.length > 0 ? (
              <div>
                <h3 style={styles.h3}>Weight History</h3>
                <pre>{JSON.stringify(storeData.weights, null, 2)}</pre>
              </div>
            ) : (
              <p>No health data recorded yet.</p>
            )}
            {storeData.vomits && storeData.vomits.length > 0 && (
              <div>
                <h3 style={styles.h3}>Vomit Records</h3>
                <pre>{JSON.stringify(storeData.vomits, null, 2)}</pre>
              </div>
            )}
            {storeData.assessments && storeData.assessments.length > 0 && (
              <div>
                <h3 style={styles.h3}>Health Assessments</h3>
                <pre>{JSON.stringify(storeData.assessments, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'nutrition' && selectedPet && (
        <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
          <div style={styles.card}>
            <h2 style={styles.h2}>Nutrition for {getPetName(selectedPet)}</h2>
            {storeData.meals && storeData.meals.length > 0 ? (
              <div>
                <h3 style={styles.h3}>Meals</h3>
                <pre>{JSON.stringify(storeData.meals, null, 2)}</pre>
              </div>
            ) : (
              <p>No meal data recorded yet.</p>
            )}
            {storeData.drinks && storeData.drinks.length > 0 && (
              <div>
                <h3 style={styles.h3}>Drinks</h3>
                <pre>{JSON.stringify(storeData.drinks, null, 2)}</pre>
              </div>
            )}
          </div>
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
                    Consistency:
                    <select
                      value={logFormData.consistency}
                      onChange={(e) => setLogFormData({...logFormData, consistency: e.target.value})}
                    >
                      <option value="">Select...</option>
                      <option value="hard">Hard</option>
                      <option value="normal">Normal</option>
                      <option value="soft">Soft</option>
                      <option value="diarrhea">Diarrhea</option>
                    </select>
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Color:
                    <select
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
                  Urine Amount (1-5):
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={logFormData.urine_amount}
                    onChange={(e) => setLogFormData({...logFormData, urine_amount: e.target.value})}
                  />
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
                    Consistency:
                    <select
                      value={logFormData.consistency}
                      onChange={(e) => setLogFormData({...logFormData, consistency: e.target.value})}
                    >
                      <option value="">Select...</option>
                      <option value="hard">Hard</option>
                      <option value="normal">Normal</option>
                      <option value="soft">Soft</option>
                      <option value="diarrhea">Diarrhea</option>
                    </select>
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Color:
                    <select
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
                  Urine Amount (1-5):
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={logFormData.urine_amount}
                    onChange={(e) => setLogFormData({...logFormData, urine_amount: e.target.value})}
                  />
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
            <div style={styles.dialogButtons}>
              <button style={styles.actionButton} onClick={submitLogMedication}>Submit</button>
              <button style={styles.actionButton} onClick={() => setShowMedDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
