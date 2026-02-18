import { useState, useEffect, useMemo } from 'react';
import { usePets } from './hooks/usePets';
import { useVisits } from './hooks/useVisits';
import { PetHealthAPI } from './services/petHealthApi';
import type { View, PetEntry, HomeAssistant, Visit, MedicationLog, StoreData, Medication } from './types';
import './App.css';

interface AppProps {
  hass: HomeAssistant;
}

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
    <div className="pet-health-container">
      <div className="header">
        <h1>🐾 Pet Health</h1>

        <div className="pet-selector">
          {pets.map(pet => (
            <button
              key={pet.entry_id}
              className={`pet-button ${pet.entry_id === selectedPetId ? 'selected' : ''}`}
              onClick={() => setSelectedPetId(pet.entry_id)}
            >
              <img
                src={getPetImageUrl(pet)}
                alt={getPetName(pet)}
                className="pet-button-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/pet_health_panel/default-other.svg';
                }}
              />
              <span className="pet-button-name">{getPetName(pet)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="navigation">
        <button
          className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`nav-button ${currentView === 'visits' ? 'active' : ''}`}
          onClick={() => setCurrentView('visits')}
        >
          Bathroom Visits
        </button>
        <button
          className={`nav-button ${currentView === 'medications' ? 'active' : ''}`}
          onClick={() => setCurrentView('medications')}
        >
          Medications
        </button>
        <button
          className={`nav-button ${currentView === 'health' ? 'active' : ''}`}
          onClick={() => setCurrentView('health')}
        >
          Health
        </button>
        <button
          className={`nav-button ${currentView === 'nutrition' ? 'active' : ''}`}
          onClick={() => setCurrentView('nutrition')}
        >
          Nutrition
        </button>
      </div>

      {currentView === 'dashboard' && selectedPet && (
        <div className="content">
          <div className="card">
            <h2>Dashboard for {getPetName(selectedPet)}</h2>
            <div className="stats">
              <div className="stat-card">
                <div className="stat-label">Total Visits</div>
                <div className="stat-value">{visits.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Today's Visits</div>
                <div className="stat-value">
                  {visits.filter(v => {
                    const visitDate = new Date(v.timestamp);
                    const today = new Date();
                    return visitDate.toDateString() === today.toDateString();
                  }).length}
                </div>
              </div>
              {unknownVisits.length > 0 && (
                <div className="stat-card">
                  <div className="stat-label">Unknown Visits</div>
                  <div className="stat-value">{unknownVisits.length}</div>
                </div>
              )}
            </div>
            <div className="action-buttons">
              <button className="action-button" onClick={handleLogVisit}>
                Log Bathroom Visit
              </button>
              <button className="action-button" onClick={handleLogMedication}>
                Log Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'visits' && selectedPet && (
        <div className="content">
          <div className="card">
            <h2>Bathroom Visits for {getPetName(selectedPet)}</h2>
            <button className="action-button" onClick={handleLogVisit}>
              Log New Visit
            </button>

            {visits.length === 0 ? (
              <p>No visits recorded yet.</p>
            ) : (
              <div className="visits-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Pee</th>
                      <th>Poop</th>
                      <th>Consistency</th>
                      <th>Color</th>
                      <th>Urine Amount</th>
                      <th>Notes</th>
                      <th>Confirmed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 50).map(visit => (
                      <tr key={visit.visit_id}>
                        <td>{formatTimestamp(visit.timestamp)}</td>
                        <td>{visit.did_pee ? '✓' : ''}</td>
                        <td>{visit.did_poop ? '✓' : ''}</td>
                        <td>{visit.poop_consistencies || ''}</td>
                        <td>{visit.poop_color || ''}</td>
                        <td>{visit.urine_amount || ''}</td>
                        <td>{visit.notes || ''}</td>
                        <td>{visit.confirmed ? '✓' : '?'}</td>
                        <td>
                          <div className="action-buttons-inline">
                            {!visit.confirmed && (
                              <button
                                className="small-button"
                                onClick={() => handleConfirmVisit(visit.visit_id)}
                                title="Confirm"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              className="small-button"
                              onClick={() => handleAmendVisit(visit)}
                              title="Amend"
                            >
                              ✏️
                            </button>
                            <button
                              className="small-button"
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
                <h3>Unknown Visits (Need Assignment)</h3>
                <div className="visits-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Pee</th>
                        <th>Poop</th>
                        <th>Notes</th>
                        <th>Assign To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unknownVisits.map(visit => (
                        <tr key={visit.visit_id}>
                          <td>{formatTimestamp(visit.timestamp)}</td>
                          <td>{visit.did_pee ? '✓' : ''}</td>
                          <td>{visit.did_poop ? '✓' : ''}</td>
                          <td>{visit.notes || ''}</td>
                          <td>
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
        <div className="content">
          <div className="card">
            <h2>Medications for {getPetName(selectedPet)}</h2>
            <button className="action-button" onClick={handleLogMedication}>
              Log Medication
            </button>

            {medications.length === 0 ? (
              <p>No medications logged yet.</p>
            ) : (
              <div className="visits-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Medication</th>
                      <th>Dosage</th>
                      <th>Unit</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.slice(0, 50).map((med, idx) => (
                      <tr key={`${med.medication_name}-${med.timestamp}-${idx}`}>
                        <td>{formatTimestamp(med.timestamp)}</td>
                        <td>{med.medication_name}</td>
                        <td>{med.dosage || ''}</td>
                        <td>{med.unit || ''}</td>
                        <td>{med.notes || ''}</td>
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
        <div className="content">
          <div className="card">
            <h2>Health Tracking for {getPetName(selectedPet)}</h2>
            {storeData.weights && storeData.weights.length > 0 ? (
              <div>
                <h3>Weight History</h3>
                <pre>{JSON.stringify(storeData.weights, null, 2)}</pre>
              </div>
            ) : (
              <p>No health data recorded yet.</p>
            )}
            {storeData.vomits && storeData.vomits.length > 0 && (
              <div>
                <h3>Vomit Records</h3>
                <pre>{JSON.stringify(storeData.vomits, null, 2)}</pre>
              </div>
            )}
            {storeData.assessments && storeData.assessments.length > 0 && (
              <div>
                <h3>Health Assessments</h3>
                <pre>{JSON.stringify(storeData.assessments, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'nutrition' && selectedPet && (
        <div className="content">
          <div className="card">
            <h2>Nutrition for {getPetName(selectedPet)}</h2>
            {storeData.meals && storeData.meals.length > 0 ? (
              <div>
                <h3>Meals</h3>
                <pre>{JSON.stringify(storeData.meals, null, 2)}</pre>
              </div>
            ) : (
              <p>No meal data recorded yet.</p>
            )}
            {storeData.drinks && storeData.drinks.length > 0 && (
              <div>
                <h3>Drinks</h3>
                <pre>{JSON.stringify(storeData.drinks, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Visit Dialog */}
      {showLogDialog && (
        <div className="dialog-overlay" onClick={() => setShowLogDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Log Bathroom Visit</h2>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={logFormData.did_pee}
                  onChange={(e) => setLogFormData({...logFormData, did_pee: e.target.checked})}
                />
                Did Pee
              </label>
            </div>
            <div className="form-group">
              <label>
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
                <div className="form-group">
                  <label>
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
                <div className="form-group">
                  <label>
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
              <div className="form-group">
                <label>
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
            <div className="form-group">
              <label>
                Notes:
                <textarea
                  value={logFormData.notes}
                  onChange={(e) => setLogFormData({...logFormData, notes: e.target.value})}
                  rows={3}
                />
              </label>
            </div>
            <div className="dialog-buttons">
              <button className="action-button" onClick={submitLogVisit}>Submit</button>
              <button className="action-button" onClick={() => setShowLogDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Amend Visit Dialog */}
      {showAmendDialog && editingVisit && (
        <div className="dialog-overlay" onClick={() => setShowAmendDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Amend Visit</h2>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={logFormData.did_pee}
                  onChange={(e) => setLogFormData({...logFormData, did_pee: e.target.checked})}
                />
                Did Pee
              </label>
            </div>
            <div className="form-group">
              <label>
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
                <div className="form-group">
                  <label>
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
                <div className="form-group">
                  <label>
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
              <div className="form-group">
                <label>
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
            <div className="form-group">
              <label>
                Notes:
                <textarea
                  value={logFormData.notes}
                  onChange={(e) => setLogFormData({...logFormData, notes: e.target.value})}
                  rows={3}
                />
              </label>
            </div>
            <div className="dialog-buttons">
              <button className="action-button" onClick={submitAmendVisit}>Submit</button>
              <button className="action-button" onClick={() => setShowAmendDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Medication Dialog */}
      {showMedDialog && (
        <div className="dialog-overlay" onClick={() => setShowMedDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Log Medication</h2>
            <div className="form-group">
              <label>
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
            <div className="form-group">
              <label>
                Dosage:
                <input
                  type="text"
                  value={medFormData.dosage}
                  onChange={(e) => setMedFormData({...medFormData, dosage: e.target.value})}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Unit:
                <input
                  type="text"
                  value={medFormData.unit}
                  onChange={(e) => setMedFormData({...medFormData, unit: e.target.value})}
                />
              </label>
            </div>
            <div className="form-group">
              <label>
                Notes:
                <textarea
                  value={medFormData.notes}
                  onChange={(e) => setMedFormData({...medFormData, notes: e.target.value})}
                  rows={3}
                />
              </label>
            </div>
            <div className="dialog-buttons">
              <button className="action-button" onClick={submitLogMedication}>Submit</button>
              <button className="action-button" onClick={() => setShowMedDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
