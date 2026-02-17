import { useState, useEffect } from 'react';
import { useHomeAssistant } from './hooks/useHomeAssistant';
import { usePets } from './hooks/usePets';
import { useVisits } from './hooks/useVisits';
import type { View, PetEntry } from './types';
import './App.css';

function App() {
  const { hass, api } = useHomeAssistant();
  const { pets, loading: petsLoading } = usePets(api);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { visits, reload: reloadVisits } = useVisits(api, selectedPetId);

  // Auto-select first pet
  useEffect(() => {
    if (pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].entry_id);
    }
  }, [pets, selectedPetId]);

  // Subscribe to data updates
  useEffect(() => {
    if (!api) return;

    let unsubscribe: (() => void) | null = null;
    
    api.subscribeToDataUpdates(() => {
      reloadVisits();
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [api, reloadVisits]);

  const selectedPet = pets.find(p => p.entry_id === selectedPetId);

  const getPetImageUrl = (pet: PetEntry) => {
    const imagePath = pet.pet_image_path || pet.data?.pet_image_path;
    if (imagePath) {
      if (imagePath.startsWith('http')) {
        return imagePath;
      } else if (imagePath.startsWith('/local/')) {
        return imagePath;
      } else {
        return `/local/${imagePath}`;
      }
    }

    const petType = pet.pet_type || 'other';
    return `/pet_health_panel/default-${petType}.svg`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleLogVisit = async () => {
    if (!api || !selectedPetId) return;

    const now = new Date();
    const timestamp = now.toISOString();

    await api.logBathroomVisit({
      config_entry_id: selectedPetId,
      timestamp,
      did_pee: true,
      did_poop: false,
      confirmed: true,
    });

    reloadVisits();
  };

  if (petsLoading || !hass) {
    return <div className="loading">Loading Pet Health...</div>;
  }

  if (pets.length === 0) {
    return (
      <div className="no-pets">
        <h2>No Pets Configured</h2>
        <p>Please add a pet through Settings → Devices & Services → Pet Health</p>
      </div>
    );
  }

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
                alt={pet.name}
                className="pet-button-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/pet_health_panel/default-other.svg';
                }}
              />
              <span className="pet-button-name">{pet.name}</span>
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
            <h2>Dashboard for {selectedPet.name}</h2>
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
            </div>
            <button className="action-button" onClick={handleLogVisit}>
              Log Quick Visit
            </button>
          </div>
        </div>
      )}

      {currentView === 'visits' && selectedPet && (
        <div className="content">
          <div className="card">
            <h2>Bathroom Visits for {selectedPet.name}</h2>
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
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 20).map(visit => (
                      <tr key={visit.visit_id}>
                        <td>{formatTimestamp(visit.timestamp)}</td>
                        <td>{visit.did_pee ? '✓' : ''}</td>
                        <td>{visit.did_poop ? '✓' : ''}</td>
                        <td>{visit.notes || ''}</td>
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
        <div className="content">
          <div className="card">
            <h2>Medications for {selectedPet.name}</h2>
            <p>Medication tracking coming soon...</p>
          </div>
        </div>
      )}

      {currentView === 'health' && selectedPet && (
        <div className="content">
          <div className="card">
            <h2>Health Tracking for {selectedPet.name}</h2>
            <p>Weight, wellbeing, and vomit tracking coming soon...</p>
          </div>
        </div>
      )}

      {currentView === 'nutrition' && selectedPet && (
        <div className="content">
          <div className="card">
            <h2>Nutrition for {selectedPet.name}</h2>
            <p>Meal and drink tracking coming soon...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
