/**
 * Pet Health Panel
 * A custom sidebar panel for managing pet health data
 */

class PetHealthPanel extends HTMLElement {
  constructor() {
    super();
    this.hass = null;
    this._currentView = 'dashboard';
    this._selectedPetId = null;
    this._configEntries = [];
    this._loadingEntries = false;
    this._visits = [];
    this._loadingVisits = false;
    this._unknownVisits = [];
    this._loadingUnknownVisits = false;
    this._medications = [];
    this._loadingMedications = false;
    this._medicationsLoadedFor = new Set();
    this._visitsLoadedFor = new Set();
    this._visitsByPet = {};
    this._editingVisitId = null;
    this._medicationsRetries = 0;
    this._storeDump = {};
    this._expandedSections = {};
    this._eventUnsubscribe = null;
  }

  showLogMedicationDialog(pet, med) {
    // Remove existing dialog if present
    const existing = this.querySelector('.ph-med-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'ph-med-modal';
    modal.innerHTML = `
      <style>
        .ph-med-modal { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; z-index:10000; }
        .ph-med-modal-backdrop { position:absolute; inset:0; background: rgba(0,0,0,0.45); }
        .ph-med-modal-card { position:relative; background: var(--card-background-color); color: var(--primary-text-color); border-radius:8px; padding:20px; width:520px; box-shadow: var(--ha-card-box-shadow); z-index:10001; }
        .ph-med-form-row { display:flex; gap:8px; margin-bottom:8px; align-items:center; }
        .ph-med-form-row > label { min-width:120px; font-size:13px; color:var(--secondary-text-color); }
        .ph-med-form-row input[type="text"], .ph-med-form-row textarea, .ph-med-form-row select { flex:1; padding:6px 8px; }
        .ph-med-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
      </style>
      <div class="ph-med-modal-backdrop"></div>
      <div class="ph-med-modal-card" role="dialog" aria-modal="true">
        <h3>Log medication for ${pet.name}</h3>
        <div class="ph-med-form-row">
          <label>Medication</label>
          <div style="flex:1;">${med.medication_name}</div>
        </div>
        <div class="ph-med-form-row">
          <label>When</label>
          <input id="ph-med-ts" type="datetime-local" />
        </div>
        <div class="ph-med-form-row">
          <label>Dosage</label>
          <input id="ph-med-dosage" type="text" value="${med.dosage || ''}" />
        </div>
        <div class="ph-med-form-row">
          <label>Unit</label>
          <input id="ph-med-unit" type="text" value="${med.unit || ''}" />
        </div>
        <div class="ph-med-form-row">
          <label>Notes</label>
          <textarea id="ph-med-notes" rows="3" placeholder="Optional notes"></textarea>
        </div>
        <div class="ph-med-actions">
          <button class="action-button ph-med-cancel">Cancel</button>
          <button class="action-button ph-med-submit">Log medication</button>
        </div>
        <div class="ph-small" style="margin-top:8px;">Tip: set the time if logging a past dose, or leave as now</div>
      </div>
    `;

    try { document.body.appendChild(modal); } catch (e) { this.appendChild(modal); }

    const tsInput = modal.querySelector('#ph-med-ts');
    const toLocalDateTime = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${mins}`;
    };
    tsInput.value = toLocalDateTime(new Date());

    modal.querySelector('.ph-med-cancel').addEventListener('click', () => this.closeDialog(modal));
    modal.querySelector('.ph-med-submit').addEventListener('click', async () => {
      const tsVal = modal.querySelector('#ph-med-ts').value;
      const dosageVal = modal.querySelector('#ph-med-dosage').value.trim();
      const unitVal = modal.querySelector('#ph-med-unit').value.trim();
      const notes = modal.querySelector('#ph-med-notes').value || '';

      if (!med.medication_id) {
        alert('Medication is not configured with an ID; cannot log.');
        return;
      }

      const payload = {
        config_entry_id: pet.entry_id,
        medication_id: med.medication_id,
      };
      if (dosageVal) payload.dosage = dosageVal;
      if (unitVal) payload.unit = unitVal;
      if (notes) payload.notes = notes;
      if (tsVal) payload.given_at = new Date(tsVal).toISOString();

      try {
        await this.callService('log_medication', payload);
        this.closeDialog(modal);
        await this.loadMedications(pet.entry_id);
      } catch (err) {
        alert('Error logging medication: ' + err.message);
      }
    });
  }

  // Format timestamp in European style: dd/mm/yyyy, 24h, no seconds
  formatTimestampEuropean(ts) {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleString('sv-SE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).replace(',', '');
    } catch (e) {
      return ts;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) {
      return;
    }

    // Subscribe to data updates
    if (!this._eventUnsubscribe) {
      this._subscribeToDataUpdates();
    }

    // Load config entries if not already loaded
    if (this._configEntries.length === 0 && !this._loadingEntries) {
      this.loadConfigEntries();
    } else {
      this.render();
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (this.hass) {
      this.loadConfigEntries();
      // Only subscribe if not already subscribed
      if (!this._eventUnsubscribe) {
        this._subscribeToDataUpdates();
      }
    }
  }

  disconnectedCallback() {
    this._unsubscribeFromDataUpdates();
  }

  _subscribeToDataUpdates() {
    if (this._eventUnsubscribe) return;
    
    if (this.hass && this.hass.connection) {
      try {
        this._eventUnsubscribe = this.hass.connection.subscribeEvents(
          (event) => this._handleDataUpdate(event),
          'pet_health_data_updated'
        );
      } catch (err) {
        console.warn('Pet health panel: Failed to subscribe to data update events:', err);
      }
    }
  }

  _unsubscribeFromDataUpdates() {
    if (this._eventUnsubscribe) {
      this._eventUnsubscribe.then((unsub) => unsub()).catch((err) => {
        console.warn('Pet health panel: Failed to unsubscribe from data update events:', err);
      });
      this._eventUnsubscribe = null;
    }
  }

  async _handleDataUpdate(event) {
    // Clear the cache for the updated pet to force reload
    const petId = event.data.pet_id;
    const dataType = event.data.data_type;
    
    if (petId) {
      this._visitsLoadedFor.delete(petId);
      this._medicationsLoadedFor.delete(petId);
    }
    
    // Reload data based on current view and selected pet
    const selectedPet = this.getSelectedPet();
    
    // Reload store dump to get all updated data
    try {
      const dump = await this.hass.callWS({ type: 'pet_health/get_store_dump' });
      this._storeDump = dump.data || {};
      
      // Flatten visits/medications for quick access
      this._visits = [];
      this._medications = [];
      Object.keys(this._storeDump).forEach((pid) => {
        const pd = this._storeDump[pid] || {};
        (pd.visits || []).forEach((v) => {
          const nv = Object.assign({}, v);
          nv.confirmed = this._normalizeConfirmed(nv.confirmed);
          this._visits.push(nv);
        });
        (pd.medications || []).forEach((m) => this._medications.push(m));
      });
      
      // Sort descending by timestamp
      this._visits.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      this._medications.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    } catch (err) {
      console.error('Pet health panel: Failed to reload store dump after data update:', err);
    }
    
    // Reload unknown visits if needed
    await this.loadUnknownVisits();
    
    // Refresh the display
    this.render();
  }

  async loadConfigEntries() {
    if (this._loadingEntries) return;
    this._loadingEntries = true;

    try {
      // Use the integration's websocket command so we get the internal pet_id
      const result = await this.hass.callWS({
        type: 'pet_health/get_pet_data',
      });

      this._configEntries = result.entries || [];

      // After loading entries, fetch authoritative store dump (all pets)
      try {
        const dump = await this.hass.callWS({ type: 'pet_health/get_store_dump' });
        this._storeDump = dump.data || {};

        // Flatten visits/medications for quick access as legacy arrays
        this._visits = [];
        this._medications = [];
        Object.keys(this._storeDump).forEach((pid) => {
          const pd = this._storeDump[pid] || {};
          (pd.visits || []).forEach((v) => {
            const nv = Object.assign({}, v);
            nv.confirmed = this._normalizeConfirmed(nv.confirmed);
            this._visits.push(nv);
          });
          (pd.medications || []).forEach((m) => this._medications.push(m));
        });

        // Sort descending by timestamp
        this._visits.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        this._medications.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      } catch (err) {
        console.log('Failed to load store dump:', err);
        this._storeDump = {};
      }

      // Load unknown visits
      await this.loadUnknownVisits();

      // Config entries loaded

      // Select first pet if none selected
      if (!this._selectedPetId && this._configEntries.length > 0) {
        this._selectedPetId = this._configEntries[0].entry_id;
      }
          // Determine whether selected pet has medications to show/hide tab
          const selectedPet = this.getSelectedPet();
          let hasMedications = false;
          if (selectedPet) {
            const selInternal = this.getPetIdFromEntry(selectedPet.entry_id);
            const pd = (this._storeDump && (this._storeDump[selInternal] || this._storeDump[selectedPet.entry_id]))
              ? (this._storeDump[selInternal] || this._storeDump[selectedPet.entry_id])
              : {};
            const configEntry = this._configEntries.find((e) => e.entry_id === selectedPet.entry_id);
            hasMedications = (pd.medications && pd.medications.length > 0) ||
              (this._medications && this._medications.some((m) => m.pet_id === selectedPet.entry_id || m.pet_id === selInternal)) ||
              (configEntry && Array.isArray(configEntry.medications) && configEntry.medications.length > 0);
          }
    } catch (err) {
      console.error('Failed to load pet config entries:', err);
      this._configEntries = [];
    } finally {
      this._loadingEntries = false;
      this.render();
    }
  }

  render() {
    if (!this.hass) {
      return;
    }

    // Show loading state while fetching config entries
    if (this._loadingEntries) {
      this.innerHTML = `
        <style>
          :host {
            display: block;
            height: 100%;
            background: var(--primary-background-color);
            overflow: auto;
          }
          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 18px;
            color: var(--primary-text-color);
          }
        </style>
        <div class="loading">Loading pets...</div>
      `;
      return;
    }

    // Get pet config entries
    const pets = this.getPets();

    // If no pet selected, select the first one
    if (!this._selectedPetId && pets.length > 0) {
      this._selectedPetId = pets[0].entry_id;
    }

    // Compute unconfirmed visits count for selected pet (for badge) + unknown visits count
    const selectedPet = this.getSelectedPet();
    let unconfirmedCount = 0;
    if (selectedPet) {
      const selInternal = this.getPetIdFromEntry(selectedPet.entry_id);
      unconfirmedCount = this._visits.filter(v => v.pet_id === selectedPet.entry_id || v.pet_id === selInternal).filter(v => !v.confirmed).length;
    }
    // Add unknown visits to the badge count
    unconfirmedCount += (this._unknownVisits || []).length;

    // Determine whether selected pet has medications to show/hide tab
    let hasMedications = false;
    if (selectedPet) {
      const selInternal = this.getPetIdFromEntry(selectedPet.entry_id);
      const pd = (this._storeDump && (this._storeDump[selInternal] || this._storeDump[selectedPet.entry_id]))
        ? (this._storeDump[selInternal] || this._storeDump[selectedPet.entry_id])
        : {};
      const configEntry = this._configEntries.find((e) => e.entry_id === selectedPet.entry_id);
      hasMedications = (pd.medications && pd.medications.length > 0) ||
        (this._medications && this._medications.some((m) => m.pet_id === selectedPet.entry_id || m.pet_id === selInternal)) ||
        (configEntry && Array.isArray(configEntry.medications) && configEntry.medications.length > 0);
    }

    this.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          background: var(--primary-background-color);
          overflow: auto;
        }

        .pet-health-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px;
        }

        .header {
          background: var(--card-background-color);
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 16px;
          box-shadow: var(--ha-card-box-shadow);
        }

        .header h1 {
          margin: 0 0 16px 0;
          font-size: 28px;
          color: var(--primary-text-color);
        }

        .pet-selector {
          margin: 16px 0;
        }

        .pet-selector select {
          width: 100%;
          padding: 12px;
          font-size: 16px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
        }

        .navigation {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .nav-button {
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
          box-shadow: var(--ha-card-box-shadow);
        }

        .nav-button:hover {
          background: var(--secondary-background-color);
        }

        .nav-button.active {
          background: var(--primary-color);
          color: var(--text-primary-color);
        }

        .content-area {
          background: var(--card-background-color);
          border-radius: 8px;
          padding: 24px;
          box-shadow: var(--ha-card-box-shadow);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: var(--primary-background-color);
          border-radius: 8px;
          padding: 16px;
          border-left: 4px solid var(--primary-color);
        }

        .stat-card h3 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: var(--secondary-text-color);
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: var(--primary-text-color);
        }

        .stat-subtext {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }

        .action-section {
          margin-top: 24px;
        }

        .action-section h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          color: var(--primary-text-color);
        }

        .action-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .action-button {
          padding: 16px;
          border: none;
          border-radius: 8px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .action-button:hover {
          background: var(--dark-primary-color);
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: var(--secondary-text-color);
        }

        .empty-state ha-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        .badge {
          display: inline-block;
          min-width: 20px;
          padding: 2px 6px;
          margin-left: 8px;
          font-size: 12px;
          line-height: 16px;
          color: var(--text-primary-color);
          background: var(--primary-color);
          border-radius: 12px;
          text-align: center;
        }
      </style>

      <div class="pet-health-container">
        <div class="header">
          <h1>🐾 Pet Health Dashboard</h1>

          ${pets.length === 0 ? `
            <div class="empty-state">
              <p>No pets configured yet. Add a pet in the Home Assistant integration settings.</p>
            </div>
          ` : `
            <div class="pet-selector">
              <select id="pet-select">
                ${pets.map(pet => `
                  <option value="${pet.entry_id}" ${pet.entry_id === this._selectedPetId ? 'selected' : ''}>
                    ${this.getPetIcon(pet.type)} ${pet.name}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="navigation">
              <button class="nav-button ${this._currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
                📊 Dashboard
              </button>
              <button class="nav-button ${this._currentView === 'visits' ? 'active' : ''}" data-view="visits">
                🚽 Bathroom Visits ${unconfirmedCount > 0 ? `<span class="badge">${unconfirmedCount}</span>` : ''}
              </button>
              <button class="nav-button ${this._currentView === 'medications' ? 'active' : ''}" data-view="medications">
                💊 Medications
              </button>
              <button class="nav-button ${this._currentView === 'nutrition' ? 'active' : ''}" data-view="nutrition">
                🍽️ Food & Drink
              </button>
              <button class="nav-button ${this._currentView === 'health' ? 'active' : ''}" data-view="health">
                ❤️ Health & Weight
              </button>
            </div>
          `}
        </div>

        ${pets.length > 0 ? this.renderView() : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  renderView() {
    const pet = this.getSelectedPet();
    if (!pet) return '<div class="empty-state">Pet not found</div>';

    // Load visits when switching to visits view (per-pet)
    if (this._currentView === 'visits' && !this._loadingVisits) {
      const selPet = this.getSelectedPet();
      if (selPet && !this._visitsLoadedFor.has(selPet.entry_id)) {
        this.loadVisits(selPet.entry_id);
      }
    }

    // Load medications when switching to medications view (per-pet)
    if (this._currentView === 'medications' && !this._loadingMedications) {
      const selPet = this.getSelectedPet();
      if (selPet && !this._medicationsLoadedFor.has(selPet.entry_id)) {
        this.loadMedications(selPet.entry_id);
      }
    }

    switch (this._currentView) {
      case 'dashboard':
        return this.renderDashboard(pet);
      case 'visits':
        return this.renderVisits(pet);
        case 'nutrition':
          return this.renderNutrition(pet);
      case 'medications':
        return this.renderMedications(pet);
      case 'health':
        return this.renderHealth(pet);
      default:
        return '';
    }
  }

  renderDashboard(pet) {
    // Prefer store dump for dashboard metrics
    const petInternalId = this.getPetIdFromEntry(pet.entry_id);
    const pd = (this._storeDump && (this._storeDump[petInternalId] || this._storeDump[pet.entry_id]))
      ? (this._storeDump[petInternalId] || this._storeDump[pet.entry_id])
      : {};

    const visits = pd.visits || [];
    const meds = pd.medications || [];
    const meals = pd.meals || [];
    const drinks = pd.drinks || [];
    const weight = pd.weight || [];
    const wellbeing = pd.wellbeing || [];

    // Latest records (store lists are sorted desc)
    const lastVisit = visits.length > 0 ? visits[0] : null;
    const lastMed = meds.length > 0 ? meds[0] : null;
    const lastMeal = meals.length > 0 ? meals[0] : null;
    const lastDrink = drinks.length > 0 ? drinks[0] : null;
    const latestWeight = weight.length > 0 ? weight[0] : null;
    const latestWellbeing = wellbeing.length > 0 ? wellbeing[0] : null;

    const formatTs = (ts) => this.formatTimestampEuropean(ts);
    const hoursSince = (ts) => {
      if (!ts) return 'N/A';
      const diff = Date.now() - new Date(ts).getTime();
      const hours = diff / (1000 * 60 * 60);
      if (hours < 1) {
        const mins = Math.round(diff / (1000 * 60));
        return `${mins} min`;
      }
      return `${hours.toFixed(1)} h`;
    };

    // Today's visits (local day start)
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    const todaysVisits = visits.filter(v => new Date(v.timestamp).getTime() >= startOfDay.getTime()).length;

    const unconfirmedCount = visits.filter(v => !v.confirmed).length;

    return `
      <div class="content-area">
        <h2>Overview for ${pet.name}</h2>

        <div class="stats-grid">
          <div class="stat-card">
            <h3>Last bathroom visit</h3>
            <div class="stat-value">${lastVisit ? formatTs(lastVisit.timestamp) : 'N/A'}</div>
            <div class="stat-subtext">${lastVisit ? `${hoursSince(lastVisit.timestamp)} ago` : ''}</div>
          </div>

          <div class="stat-card">
            <h3>Visits today</h3>
            <div class="stat-value">${todaysVisits}</div>
            <div class="stat-subtext">Unconfirmed: ${unconfirmedCount}</div>
          </div>

          <div class="stat-card">
            <h3>Hours since last visit</h3>
            <div class="stat-value">${lastVisit ? hoursSince(lastVisit.timestamp) : 'N/A'}</div>
            ${lastVisit ? `<div class="stat-subtext">Recorded: ${formatTs(lastVisit.timestamp)}</div>` : ''}
          </div>

          <div class="stat-card">
            <h3>Last medication</h3>
            <div class="stat-value">${lastMed ? formatTs(lastMed.given_at || lastMed.given_time || lastMed.timestamp) : 'N/A'}</div>
            ${lastMed ? `<div class="stat-subtext">${lastMed.medication_name || ''}</div>` : ''}
          </div>

          <div class="stat-card">
            <h3>Last meal / drink</h3>
            <div class="stat-value">${lastMeal ? formatTs(lastMeal.timestamp) : (lastDrink ? formatTs(lastDrink.timestamp) : 'N/A')}</div>
            ${lastMeal ? `<div class="stat-subtext">Meal: ${lastMeal.meal_type || lastMeal.amount || ''}</div>` : lastDrink ? `<div class="stat-subtext">Drink: ${lastDrink.drink_type || lastDrink.amount || ''}</div>` : ''}
          </div>

          <div class="stat-card">
            <h3>Latest weight</h3>
            <div class="stat-value">${latestWeight && latestWeight.weight_grams != null ? `${(latestWeight.weight_grams / 1000).toFixed(1)} kg` : 'N/A'}</div>
            ${latestWeight ? `<div class="stat-subtext">${latestWeight.weight_grams} g — Recorded: ${formatTs(latestWeight.timestamp)}</div>` : ''}
          </div>

          <div class="stat-card">
            <h3>Wellbeing</h3>
            <div class="stat-value">${latestWellbeing && latestWellbeing.wellbeing_score != null ? latestWellbeing.wellbeing_score : 'N/A'}</div>
            ${latestWellbeing ? `<div class="stat-subtext">Recorded: ${formatTs(latestWellbeing.timestamp)}</div>` : ''}
          </div>
        </div>

        <div class="action-section">
          <h2>Quick actions</h2>
          <div class="action-buttons">
              <button class="action-button" data-action="log-bathroom">🚽 Log Bathroom Visit</button>
              <button class="action-button" data-action="log-vomit">🤮 Log Vomit</button>
            </div>
        </div>
      </div>
    `;
  }

  renderVisits(pet) {
    if (this._loadingVisits) {
      return `
        <div class="content-area">
          <h2>Bathroom Visit History</h2>
          <p>Loading visits...</p>
        </div>
      `;
    }

    // Filter visits for this pet
    const petInternalId = this.getPetIdFromEntry(pet.entry_id);
    // Prefer per-pet cached visits if available (loaded via loadVisits with pet_id),
    // otherwise fall back to the global visits array (store dump)
    const sourceVisits = this._visitsByPet[pet.entry_id] || this._visits;
    const petVisits = sourceVisits.filter(
      (v) => v.pet_id === pet.entry_id || v.pet_id === petInternalId
    );

    const unconfirmedVisits = petVisits.filter((v) => !v.confirmed);
    const confirmedVisits = petVisits.filter((v) => v.confirmed);

    const unconfirmedKey = `visits_unconfirmed:${pet.entry_id}`;
    const confirmedKey = `visits_confirmed:${pet.entry_id}`;
    const unconfirmedExpanded = !!this._expandedSections[unconfirmedKey];
    const confirmedExpanded = !!this._expandedSections[confirmedKey];

    const unconfirmedShown = unconfirmedExpanded ? unconfirmedVisits : unconfirmedVisits.slice(0, 5);
    const confirmedShown = confirmedExpanded ? confirmedVisits : confirmedVisits.slice(0, 5);

    // Get unknown visits (for all pets)
    const unknownVisits = this._unknownVisits || [];
    const unknownKey = 'visits_unknown';
    const unknownExpanded = !!this._expandedSections[unknownKey];
    const unknownShown = unknownExpanded ? unknownVisits : unknownVisits.slice(0, 5);

    return `
      <div class="content-area">
        <h2>Bathroom Visit History for ${pet.name}</h2>

        ${unknownVisits.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h3 style="color: #9c27b0; margin-bottom: 16px;">❓ Unknown Pet Visits (${unknownVisits.length})</h3>
            <p style="color: var(--secondary-text-color); margin-bottom: 12px; font-size: 13px;">
              These visits were detected but don't have a pet assigned. Use "Reassign" to assign them to the correct pet.
            </p>
            ${this.renderVisitsTable(unknownShown, true)}
            ${unknownVisits.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="visits_unknown">${unknownExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}
          </div>
        ` : ''}

        ${unconfirmedVisits.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h3 style="color: #ff9800; margin-bottom: 16px;">⚠️ Unconfirmed Visits (${unconfirmedVisits.length})</h3>
            ${this.renderVisitsTable(unconfirmedShown, true)}
            ${unconfirmedVisits.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="visits_unconfirmed" data-pet="${pet.entry_id}">${unconfirmedExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}
          </div>
        ` : ''}

        <div>
          <h3 style="margin-bottom: 16px;">✅ Recent Visits</h3>
          ${confirmedVisits.length > 0 ?
            `${this.renderVisitsTable(confirmedShown, true)}${confirmedVisits.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="visits_confirmed" data-pet="${pet.entry_id}">${confirmedExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}` :
            '<p style="color: var(--secondary-text-color);">No confirmed visits yet</p>'}
        </div>
      </div>
      <div style="margin-top:16px;">
        <button class="action-button" data-action="log-bathroom">🚽 Log Bathroom Visit</button>
      </div>
    `;
  }


  renderVisitsTable(visits, showActions) {
    const allPets = this.getPets();

    return `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: var(--card-background-color);">
          <thead>
            <tr style="border-bottom: 2px solid var(--divider-color);">
              <th style="padding: 12px; text-align: left;">Time</th>
              <th style="padding: 12px; text-align: center;">Pee</th>
              <th style="padding: 12px; text-align: center;">Poop</th>
              <th style="padding: 12px; text-align: left;">Details</th>
              <th style="padding: 12px; text-align: left;">Notes</th>
              ${showActions ? '<th style="padding: 12px; text-align: center;">Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${visits.map(visit => this.renderVisitRow(visit, showActions, allPets)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderVisitRow(visit, showActions, allPets) {
    const timestamp = new Date(visit.timestamp);
    const timeStr = this.formatTimestampEuropean(timestamp);
    const isEditing = this._editingVisitId === visit.visit_id;

    const poopDetails = [];
    if (visit.poop_consistencies && visit.poop_consistencies.length > 0) {
      poopDetails.push(`Consistency: ${visit.poop_consistencies.join(', ')}`);
    }
    if (visit.poop_color) {
      poopDetails.push(`Color: ${visit.poop_color}`);
    }

    const urineDetails = [];
    if (visit.urine_amount) {
      urineDetails.push(`Amount: ${visit.urine_amount}`);
    }

    const details = [...poopDetails, ...urineDetails].join('; ');

    return `
      <tr style="border-bottom: 1px solid var(--divider-color);">
        <td style="padding: 12px; white-space: nowrap;">${timeStr}</td>
        <td style="padding: 12px; text-align: center;">${visit.did_pee ? '✓' : '−'}</td>
        <td style="padding: 12px; text-align: center;">${visit.did_poop ? '✓' : '−'}</td>
        <td style="padding: 12px; font-size: 14px; color: var(--secondary-text-color);">${details || '−'}</td>
        <td style="padding: 12px; font-size: 14px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${visit.notes || '−'}</td>
        ${showActions ? `
          <td style="padding: 12px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
              <button class="visit-action-btn" data-action="confirm" data-visit-id="${visit.visit_id}"
                style="padding: ${visit.confirmed ? '4px 8px' : '6px 12px'}; border: none; border-radius: 4px; background: #4caf50; color: white; cursor: pointer; font-size: ${visit.confirmed ? '11px' : '12px'};">
                ✓ Confirm
              </button>
              <button class="visit-action-btn" data-action="amend" data-visit-id="${visit.visit_id}"
                style="padding: ${visit.confirmed ? '4px 8px' : '6px 12px'}; border: none; border-radius: 4px; background: #2196f3; color: white; cursor: pointer; font-size: ${visit.confirmed ? '11px' : '12px'};">
                ✏️ Amend
              </button>
              <button class="visit-action-btn" data-action="reassign" data-visit-id="${visit.visit_id}"
                style="padding: ${visit.confirmed ? '4px 8px' : '6px 12px'}; border: none; border-radius: 4px; background: #ff9800; color: white; cursor: pointer; font-size: ${visit.confirmed ? '11px' : '12px'};">
                🔄 Reassign
              </button>
              <button class="visit-action-btn" data-action="delete" data-visit-id="${visit.visit_id}"
                style="padding: ${visit.confirmed ? '4px 8px' : '6px 12px'}; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer; font-size: ${visit.confirmed ? '11px' : '12px'};">
                🗑️ Delete
              </button>
            </div>
          </td>
        ` : ''}
      </tr>
    `;
  }

  getPetIdFromEntry(entryId) {
    const entry = this._configEntries.find((e) => e.entry_id === entryId);
    // Entries may come from different sources: older shape uses entry.data.pet_id,
    // newer websocket helper returns a flat object with pet_id at top-level.
    return entry?.data?.pet_id ?? entry?.pet_id;
  }

  _normalizeConfirmed(val) {
    // Accept multiple shapes for the "confirmed" flag (boolean, string, number)
    if (val === true) return true;
    if (val === 'true') return true;
    if (val === 1) return true;
    if (val === '1') return true;
    return false;
  }

  async loadVisits() {
    // Accept optional pet id so we only attempt to load visits for a specific pet
    const args = Array.from(arguments);
    const petId = args[0] || null;

    if (this._loadingVisits) return;
    if (petId && this._visitsLoadedFor.has(petId)) return;

    this._loadingVisits = true;

    try {
      // The frontend uses config entry IDs as keys, but the backend websocket
      // commands expect the internal pet id. If a UI entry_id was provided,
      // map it to the internal id for the WS call but keep storing the results
      // under the UI entry_id so the rest of the UI (which keys by entry_id)
      // continues to work.
      let wsPetId = petId;
      if (petId) {
        // If petId looks like a UI entry_id, try to map to internal pet id
        const maybeInternal = this.getPetIdFromEntry(petId);
        if (maybeInternal) wsPetId = maybeInternal;
      }

      const payload = wsPetId ? { type: 'pet_health/get_visits', pet_id: wsPetId } : { type: 'pet_health/get_visits' };
      const result = await this.hass.callWS(payload);

      if (petId) {
        // Normalize confirmed flag for each visit and store under UI entry_id
        this._visitsByPet[petId] = (result.visits || []).map((v) => ({ ...v, confirmed: this._normalizeConfirmed(v.confirmed) }));

        // Sort per-pet visits by logged_at (preferred) then timestamp, newest first
        const toTs = (t) => {
          if (!t) return 0;
          try { const d = new Date(t); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); } catch (e) { return 0; }
        };
        this._visitsByPet[petId].sort((a, b) => {
          const ta = toTs(a.logged_at || a.timestamp);
          const tb = toTs(b.logged_at || b.timestamp);
          return tb - ta;
        });

        this._visitsLoadedFor.add(petId);
      } else {
        this._visits = (result.visits || []).map((v) => ({ ...v, confirmed: this._normalizeConfirmed(v.confirmed) }));

        // Sort global visits as well by logged_at then timestamp (newest first)
        const toTsGlobal = (t) => {
          if (!t) return 0;
          try { const d = new Date(t); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); } catch (e) { return 0; }
        };
        this._visits.sort((a, b) => toTsGlobal(b.logged_at || b.timestamp) - toTsGlobal(a.logged_at || a.timestamp));
      }

    } catch (err) {
      console.error('Failed to load visits:', err);
      if (petId) {
        this._visitsByPet[petId] = [];
        this._visitsLoadedFor.add(petId);
      } else {
        this._visits = [];
      }
    } finally {
      this._loadingVisits = false;
      this.render();
    }
  }

  async loadUnknownVisits() {
    if (this._loadingUnknownVisits) return;
    this._loadingUnknownVisits = true;

    try {
      const result = await this.hass.callWS({ type: 'pet_health/get_unknown_visits' });
      this._unknownVisits = (result.visits || []).map((v) => ({ ...v, confirmed: this._normalizeConfirmed(v.confirmed) }));
      
      // Sort by timestamp, newest first
      const toTs = (t) => {
        if (!t) return 0;
        try { const d = new Date(t); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); } catch (e) { return 0; }
      };
      this._unknownVisits.sort((a, b) => toTs(b.timestamp) - toTs(a.timestamp));
    } catch (err) {
      console.error('Failed to load unknown visits:', err);
      this._unknownVisits = [];
    } finally {
      this._loadingUnknownVisits = false;
      this.render();
    }
  }

  async loadMedications() {
    // Accept optional pet id to load meds for a single pet and avoid repeated reloads
    const args = Array.from(arguments);
    const petId = args[0] || null;

    if (this._loadingMedications) return;
    // If we've already attempted to load medications for this pet, skip
    if (petId && this._medicationsLoadedFor.has(petId)) return;

    this._loadingMedications = true;

    try {
      // If a UI `entry_id` was passed in, map it to the internal pet id expected
      // by the backend websocket command. This mirrors the mapping used by
      // `loadVisits` and ensures that calling `loadMedications(pet.entry_id)`
      // returns data for the correct pet.
      let wsPetId = petId;
      if (petId) {
        const maybeInternal = this.getPetIdFromEntry(petId);
        if (maybeInternal) wsPetId = maybeInternal;
      }

      const payload = wsPetId ? { type: 'pet_health/get_medications', pet_id: wsPetId } : { type: 'pet_health/get_medications' };
      const result = await this.hass.callWS(payload);
      console.log('pet-health: loadMedications result', { petId, wsPetId, result });

      this._medications = result.medications || [];
      if (petId) this._medicationsLoadedFor.add(petId);
    } catch (err) {
      // If the backend hasn't registered the websocket command yet, retry a few times
      if (err && err.code === 'unknown_command' && this._medicationsRetries < 5) {
        this._medicationsRetries += 1;
        const retryDelay = 300 * this._medicationsRetries; // ms
        setTimeout(() => {
          this._loadingMedications = false;
          this.loadMedications(petId);
        }, retryDelay);
        return;
      }

      console.error('Failed to load medications:', err);
      this._medications = [];
      if (petId) this._medicationsLoadedFor.add(petId);
    } finally {
      this._loadingMedications = false;
      this.render();
    }
  }

  renderMedications(pet) {
    // Prefer store-backed medication records, but merge with sensor-derived records and dedupe
    const sensors = this.getPetSensors(pet.entry_id);

    // Find medication-related sensors by key
    const medSensorEntries = Object.entries(sensors).filter(([key]) =>
      key.includes('medic') || key.includes('med_') || key.includes('medication')
    );

    const medsFromSensors = [];

    medSensorEntries.forEach(([key, sensor]) => {
      // Common shapes: attributes.medications (array of objects), attributes.medication_records, or a single-record sensor
      const attrs = sensor.attributes || {};

      if (Array.isArray(attrs.medications) && attrs.medications.length > 0) {
        attrs.medications.forEach((m) =>
          medsFromSensors.push({
            medication_name: m.medication_name || m.name || m.medication || '',
            timestamp: m.timestamp || sensor.last_changed || new Date().toISOString(),
            given_at: m.given_at || m.given_time || m.givenAt || null,
            medication_id: m.medication_id || m.med_id || m.id || attrs.medication_id || null,
            dosage: m.dosage || m.amount || '',
            unit: m.unit || '',
            notes: m.notes || m.note || '',
            pet_id: attrs.pet || pet.entry_id,
          })
        );
        return;
      }

      if (Array.isArray(attrs.medication_records) && attrs.medication_records.length > 0) {
        attrs.medication_records.forEach((m) =>
          medsFromSensors.push({
            medication_name: m.medication_name || m.name || '',
            timestamp: m.timestamp || sensor.last_changed || new Date().toISOString(),
            given_at: m.given_at || m.given_time || m.givenAt || null,
            medication_id: m.medication_id || m.med_id || m.id || attrs.medication_id || null,
            dosage: m.dosage || '',
            unit: m.unit || '',
            notes: m.notes || '',
            pet_id: attrs.pet || pet.entry_id,
          })
        );
        return;
      }

      // If sensor represents a single last-medication event, try to build a record
      if (sensor.state && sensor.state !== 'unknown' && sensor.state !== 'unavailable') {
        // Detect if the sensor.state appears to be an ISO timestamp
        const looksLikeIso = (s) => {
          if (!s || typeof s !== 'string') return false;
          // Quick check for ISO-like format (YYYY-)
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(s)) return false;
          try {
            const d = new Date(s);
            return !Number.isNaN(d.getTime());
          } catch (e) {
            return false;
          }
        };

        let givenAt = attrs.given_at || attrs.given_time || attrs.givenAt || null;
        if (!givenAt && looksLikeIso(sensor.state)) {
          givenAt = sensor.state;
        }

        const medNameFallback = attrs.medication_name || attrs.name || key;
        const medicationName = looksLikeIso(sensor.state) ? medNameFallback : (attrs.medication_name || sensor.state || key);

        medsFromSensors.push({
          medication_name: medicationName,
          timestamp: sensor.last_changed || new Date().toISOString(),
          given_at: givenAt,
          medication_id: attrs.medication_id || null,
          dosage: attrs.dosage || '',
          unit: attrs.unit || '',
          notes: attrs.notes || '',
          pet_id: attrs.pet || pet.entry_id,
        });
      }
    });

    // Debug: sensors detected and sensor-derived meds
    try {
      const sensorKeys = medSensorEntries.map(([k]) => k);
      console.log('pet-health: renderMedications start', { petEntryId: pet.entry_id, sensorKeys, medsFromSensorsCount: medsFromSensors.length });
    } catch (e) {
      console.log('pet-health: renderMedications debug failed', e);
    }

    // Get store-provided meds either from loaded _medications or from the config entry payload
    let storeMeds = [];
    const configEntry = this._configEntries.find((e) => e.entry_id === pet.entry_id);
    // Prefer authoritative store dump when available
    const petInternalId = this.getPetIdFromEntry(pet.entry_id);
    if (this._storeDump && (this._storeDump[petInternalId] || this._storeDump[pet.entry_id])) {
      const pd = this._storeDump[petInternalId] || this._storeDump[pet.entry_id] || {};
      storeMeds = (pd.medications || []).map((m) => ({
        medication_name: m.medication_name || m.name || m.medication || '',
        timestamp: m.timestamp || new Date().toISOString(),
        given_at: m.given_at || m.given_time || m.givenAt || null,
        medication_id: m.medication_id || m.med_id || m.id || null,
        dosage: m.dosage || m.amount || '',
        unit: m.unit || '',
        notes: m.notes || '',
        pet_id: petInternalId || pet.entry_id,
      }));
    } else if (this._medications && this._medications.length > 0) {
      storeMeds = this._medications.filter((m) => m.pet_id === pet.entry_id || m.pet_id === petInternalId);
    } else if (configEntry && Array.isArray(configEntry.medications) && configEntry.medications.length > 0) {
      storeMeds = configEntry.medications.map((m) => ({
        medication_name: m.medication_name || m.name || m.medication || '',
        timestamp: m.timestamp || new Date().toISOString(),
        given_at: m.given_at || m.given_time || m.givenAt || null,
        dosage: m.dosage || m.amount || '',
        unit: m.unit || '',
        notes: m.notes || '',
        pet_id: configEntry.pet_id || pet.entry_id,
      }));
    }

    // Merge: prefer storeMeds, then append sensor meds that are not duplicates
    // Mark store records so we don't filter them out as "duplicates" of themselves
    const merged = storeMeds.map((s) => ({ ...s, _fromStore: true }));
    // Use timestamp or given_at/given_time as the dedupe time key
    const seen = new Set(storeMeds.map((s) => `${(s.medication_name || '').trim()}::${s.timestamp || s.given_at || s.given_time || ''}`));
    medsFromSensors.forEach((s) => {
      const key = `${s.medication_name}::${s.timestamp}`;
      if (!seen.has(key)) {
        merged.push(s);
        seen.add(key);
      }
    });

    console.log('pet-health: merged medications', { petEntryId: pet.entry_id, mergedCount: merged.length, mergedSample: merged.slice(0,5) });

    // Filter out likely false-positive records that come from noisy sensors
    // or malformed data (e.g. numeric-only names like "0" or invalid timestamps).
    // Also de-duplicate sensor-derived records against store records using a
    // small time tolerance (2 minutes) to avoid showing the same dose twice.
    const parseTs = (ts) => {
      try {
        const d = new Date(ts);
        return Number.isNaN(d.getTime()) ? null : d.getTime();
      } catch (e) {
        return null;
      }
    };

    const TOLERANCE_MS = 2 * 60 * 1000; // 2 minutes

    // Build a list of authoritative store timestamps for dedupe. Use given_at as
    // a fallback when timestamp is not present (some backends only set given_at).
    const storeKeys = (storeMeds || []).map((s) => ({
      name: String(s.medication_name || '').trim(),
      ts: parseTs(s.timestamp || s.given_at || s.given_time),
    })).filter((s) => s.name && s.ts !== null);

    const filtered = merged.filter((m) => {
      const name = String(m.medication_name ?? '').trim();
      if (!name) return false;
      // Exclude purely numeric names (commonly produced by sensors with state '0')
      if (/^\d+$/.test(name)) return false;
      // Accept timestamp from record or fallback to given_at/given_time
      const ts = parseTs(m.timestamp || m.given_at || m.given_time);
      if (ts === null) return false;

      // Store records are always kept; only check sensor-derived records for duplicates
      if (m._fromStore) return true;

      // If this record is sensor-derived and there's a store record with the same
      // medication name within the tolerance, treat as duplicate
      const isDuplicate = storeKeys.some((sk) => sk.name === name && Math.abs(sk.ts - ts) <= TOLERANCE_MS);
      if (isDuplicate) return false;

      return true;
    });

    const meds = filtered;
    console.log('pet-health: filtered medications', { petEntryId: pet.entry_id, filteredCount: meds.length, sample: meds.slice(0,5) });

    // Sort meds by given time when available, otherwise by record timestamp (newest first)
    meds.sort((a, b) => {
      const ta = parseTs(a.given_at || a.given_time || a.timestamp) || 0;
      const tb = parseTs(b.given_at || b.given_time || b.timestamp) || 0;
      return tb - ta;
    });

    const medsKey = `medications:${pet.entry_id}`;
    const medsExpanded = !!this._expandedSections[medsKey];
    const medsShown = medsExpanded ? meds : meds.slice(0, 5);

    return `
      <div class="content-area">
        <h2>Medications for ${pet.name}</h2>

        ${(() => {
          // Build list of registered medications keyed by normalized name.
          // Prefer entries that include a medication_id over ones that don't.
          const regMap = new Map();
          const addEntry = (entry) => {
            const name = String(entry.medication_name || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            const existing = regMap.get(key);
            if (!existing) {
              regMap.set(key, entry);
              return;
            }
            // Prefer entry with medication_id
            if (!existing.medication_id && entry.medication_id) {
              regMap.set(key, entry);
            }
          };

          // From config entry
          if (configEntry && Array.isArray(configEntry.medications)) {
            configEntry.medications.forEach((m) => {
              addEntry({ medication_name: (m.medication_name || m.name || '').trim(), dosage: m.dosage || m.amount || '', unit: m.unit || '', medication_id: m.medication_id || null });
            });
          }

          // From storeMeds definitions
          (storeMeds || []).forEach((m) => {
            addEntry({ medication_name: (m.medication_name || m.name || '').trim(), dosage: m.dosage || m.amount || '', unit: m.unit || '', medication_id: m.medication_id || null });
          });

          // Also include sensor-derived medications that include an ID (prefer these)
          (medsFromSensors || []).forEach((m) => {
            if (!m.medication_id) return;
            addEntry({ medication_name: (m.medication_name || '').trim(), dosage: m.dosage || '', unit: m.unit || '', medication_id: m.medication_id || null });
          });

          const reg = Array.from(regMap.values());
          if (reg.length === 0) return '';

          return `
            <div style="margin-bottom:16px;">
              <h3>Registered medications</h3>
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; background: var(--card-background-color); margin-bottom:8px;">
                  <thead>
                    <tr style="border-bottom:2px solid var(--divider-color); text-align:left;">
                      <th style="padding:12px;">Medication</th>
                      <th style="padding:12px;">ID</th>
                      <th style="padding:12px;">Default dose</th>
                      <th style="padding:12px;">Unit</th>
                      <th style="padding:12px; text-align:center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reg.map(r => `
                      <tr>
                        <td style="padding:8px;">${r.medication_name}</td>
                        <td style="padding:8px; font-family: monospace;">${r.medication_id || '—'}</td>
                        <td style="padding:8px;">${r.dosage || '—'}</td>
                        <td style="padding:8px;">${r.unit || '—'}</td>
                        <td style="padding:8px; text-align:center;"><button class="action-button log-registered-med" data-med-id="${r.medication_id || ''}" data-med-name="${r.medication_name}" data-dosage="${r.dosage}" data-unit="${r.unit}">Log</button></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        })()}
        ${this.renderMedicationsTable(medsShown)}
        ${meds.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="medications" data-pet="${pet.entry_id}">${medsExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}
        <!-- Removed legacy quick Log Medication button; use Registered medications table above -->
      </div>
    `;
  }

  renderMedicationsTable(meds) {
    if (!meds || meds.length === 0) {
      return `<p>No medication records found. To add medications for this pet open Home Assistant > Settings > Devices & Services, find the pet's integration entry, and configure medications for the pet.</p>`;
    }

    const rows = meds
      .map(
        (m) => {
          const displayTs = m.given_at || m.given_time || m.timestamp || null;
          return `
      <tr>
        <td style="padding: 8px;">${m.medication_name}</td>
        <td style="padding: 8px;">${this.formatTimestampEuropean(displayTs)}</td>
        <td style="padding: 8px;">${m.dosage || ''} ${m.unit || ''}</td>
        <td style="padding: 8px;">${m.notes || ''}</td>
      </tr>`
        }
      )
      .join('');

    return `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: var(--card-background-color);">
          <thead>
            <tr style="border-bottom: 2px solid var(--divider-color); text-align: left;">
              <th style="padding: 12px;">Medication</th>
              <th style="padding: 12px;">Given at</th>
              <th style="padding: 12px;">Dosage</th>
              <th style="padding: 12px;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  renderHealth(pet) {
    // Use authoritative store dump for health data
    const petInternalId = this.getPetIdFromEntry(pet.entry_id);
    const pd = (this._storeDump && (this._storeDump[petInternalId] || this._storeDump[pet.entry_id]))
      ? (this._storeDump[petInternalId] || this._storeDump[pet.entry_id])
      : {};

    const weight = pd.weight || [];
    const wellbeing = pd.wellbeing || [];
    const vomit = pd.vomit || [];

    // Compute latest weight and delta (use weight_grams)
    const latestWeight = weight.length > 0 ? weight[0] : null;
    const prevWeight = weight.length > 1 ? weight[1] : null;
    let weightDelta = null;
    if (latestWeight && prevWeight && latestWeight.weight_grams != null && prevWeight.weight_grams != null) {
      weightDelta = latestWeight.weight_grams - prevWeight.weight_grams;
    }

      const weightRows = weight.length > 0 ? weight.map(w => `
        <tr>
          <td style="padding:8px;">${this.formatTimestampEuropean(w.timestamp)}</td>
          <td style="padding:8px;">${w.weight_grams != null ? w.weight_grams : ''} g</td>
          <td style="padding:8px;">${w.notes || ''}</td>
        </tr>`).join('') : '';

    const wellbeingRows = wellbeing.length > 0 ? wellbeing.map(w => `
      <tr>
        <td style="padding:8px;">${this.formatTimestampEuropean(w.timestamp)}</td>
        <td style="padding:8px;">${w.wellbeing_score != null ? w.wellbeing_score : ''}</td>
        <td style="padding:8px;">${w.notes || ''}</td>
      </tr>`).join('') : '';

    const vomitRows = vomit.length > 0 ? vomit.map(v => `
      <tr>
        <td style="padding:8px;">${this.formatTimestampEuropean(v.timestamp)}</td>
        <td style="padding:8px;">${v.vomit_type || ''}</td>
        <td style="padding:8px;">${v.notes || ''}</td>
      </tr>`).join('') : '';

    return `
      <div class="content-area">
        <h2>Health & Weight for ${pet.name}</h2>

        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px;">
          <div class="stat-card" style="min-width:200px;">
            <h3>Latest weight</h3>
            <div class="stat-value">${latestWeight && latestWeight.weight_grams != null ? `${latestWeight.weight_grams} g` : 'N/A'}</div>
            ${weightDelta != null ? `<div class="stat-subtext">Change vs previous: ${weightDelta > 0 ? '+' : ''}${weightDelta} g</div>` : ''}
            ${latestWeight ? `<div class="stat-subtext">Recorded: ${this.formatTimestampEuropean(latestWeight.timestamp)}</div>` : ''}
          </div>

          <div class="stat-card" style="min-width:200px;">
            <h3>Wellbeing (latest)</h3>
            <div class="stat-value">${wellbeing.length > 0 && wellbeing[0].wellbeing_score != null ? wellbeing[0].wellbeing_score : 'N/A'}</div>
            ${wellbeing.length > 0 ? `<div class="stat-subtext">${wellbeing[0].notes || ''}</div>` : ''}
          </div>

          <div class="stat-card" style="min-width:200px;">
            <h3>Recent vomit events</h3>
            <div class="stat-value">${vomit.length}</div>
            ${vomit.length > 0 ? `<div class="stat-subtext">Last: ${this.formatTimestampEuropean(vomit[0].timestamp)}</div>` : ''}
          </div>
        </div>

        <h3>Weight history</h3>
        ${weight.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; background: var(--card-background-color);">
              <thead>
                <tr style="border-bottom:2px solid var(--divider-color); text-align:left;">
                  <th style="padding:12px;">When</th>
                  <th style="padding:12px;">Weight</th>
                  <th style="padding:12px;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${weightRows}
              </tbody>
            </table>
          </div>
        ` : '<p>No weight records found</p>'}

        <h3 style="margin-top:18px;">Wellbeing history</h3>
        ${wellbeing.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; background: var(--card-background-color);">
              <thead>
                <tr style="border-bottom:2px solid var(--divider-color); text-align:left;">
                  <th style="padding:12px;">When</th>
                  <th style="padding:12px;">Score</th>
                  <th style="padding:12px;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${wellbeingRows}
              </tbody>
            </table>
          </div>
        ` : '<p>No wellbeing records found</p>'}

        <h3 style="margin-top:18px;">Vomit events</h3>
        ${vomit.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; background: var(--card-background-color);">
              <thead>
                <tr style="border-bottom:2px solid var(--divider-color); text-align:left;">
                  <th style="padding:12px;">When</th>
                  <th style="padding:12px;">Type</th>
                  <th style="padding:12px;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${vomitRows}
              </tbody>
            </table>
          </div>
        ` : '<p>No vomit records found</p>'}
        <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="action-button" data-action="log-weight">⚖️ Log Weight</button>
          <button class="action-button" data-action="log-vomit">🤮 Log Vomit</button>
        </div>
      </div>
    `;
  }

  renderNutrition(pet) {
    // Use store dump when available
    const petInternalId = this.getPetIdFromEntry(pet.entry_id);
    const pd = (this._storeDump && (this._storeDump[petInternalId] || this._storeDump[pet.entry_id]))
      ? (this._storeDump[petInternalId] || this._storeDump[pet.entry_id])
      : {};

    const meals = pd.meals || [];
    const drinks = pd.drinks || [];
    const thirst = pd.thirst_levels || [];
    const appetite = pd.appetite_levels || [];

    const mealsKey = `meals:${pet.entry_id}`;
    const drinksKey = `drinks:${pet.entry_id}`;
    const thirstKey = `thirst:${pet.entry_id}`;
    const appetiteKey = `appetite:${pet.entry_id}`;

    const mealsExpanded = !!this._expandedSections[mealsKey];
    const drinksExpanded = !!this._expandedSections[drinksKey];
    const thirstExpanded = !!this._expandedSections[thirstKey];
    const appetiteExpanded = !!this._expandedSections[appetiteKey];

    const mealsShown = mealsExpanded ? meals : meals.slice(0, 5);
    const drinksShown = drinksExpanded ? drinks : drinks.slice(0, 5);
    const thirstShown = thirstExpanded ? thirst : thirst.slice(0, 5);
    const appetiteShown = appetiteExpanded ? appetite : appetite.slice(0, 5);

    const mealsRows = mealsShown.length > 0 ? mealsShown.map(m => `
      <tr>
        <td style="padding:8px;">${m.meal_type || m.amount || ''}</td>
        <td style="padding:8px;">${this.formatTimestampEuropean(m.timestamp)}</td>
        <td style="padding:8px;">${m.amount || ''}</td>
        <td style="padding:8px;">${m.notes || ''}</td>
      </tr>`).join('') : '';

    const drinksRows = drinksShown.length > 0 ? drinksShown.map(d => `
      <tr>
        <td style="padding:8px;">${d.drink_type || ''}</td>
        <td style="padding:8px;">${this.formatTimestampEuropean(d.timestamp)}</td>
        <td style="padding:8px;">${d.amount || ''}</td>
        <td style="padding:8px;">${d.notes || ''}</td>
      </tr>`).join('') : '';

    const thirstList = thirstShown.length > 0 ? thirstShown.map(t => `
      <li>${this.formatTimestampEuropean(t.timestamp)}: ${t.level != null ? t.level : t.note || ''}</li>`).join('') : '<li>No records</li>';
    const appetiteList = appetiteShown.length > 0 ? appetiteShown.map(a => `
      <li>${this.formatTimestampEuropean(a.timestamp)}: ${a.level != null ? a.level : a.note || ''}</li>`).join('') : '<li>No records</li>';

    return `
      <div class="content-area">
        <h2>Food & Drink for ${pet.name}</h2>

        <h3>Meals</h3>
        ${meals.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; background: var(--card-background-color);">
              <thead>
                <tr style="border-bottom:2px solid var(--divider-color); text-align:left;">
                  <th style="padding:12px;">Type</th>
                  <th style="padding:12px;">When</th>
                  <th style="padding:12px;">Amount</th>
                  <th style="padding:12px;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${mealsRows}
              </tbody>
            </table>
          </div>
        ` : '<p>No meal records found</p>'}
        ${meals.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="meals" data-pet="${pet.entry_id}">${mealsExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}

        <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="action-button" data-action="log-meal">🍽️ Log Meal</button>
          <button class="action-button" data-action="log-drink">🥤 Log Drink</button>
        </div>

        <h3 style="margin-top:18px;">Drinks</h3>
        ${drinks.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse; background: var(--card-background-color);">
              <thead>
                <tr style="border-bottom:2px solid var(--divider-color); text-align:left;">
                  <th style="padding:12px;">Type</th>
                  <th style="padding:12px;">When</th>
                  <th style="padding:12px;">Amount</th>
                  <th style="padding:12px;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${drinksRows}
              </tbody>
            </table>
          </div>
        ` : '<p>No drink records found</p>'}
        ${drinks.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="drinks" data-pet="${pet.entry_id}">${drinksExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}

        <h3 style="margin-top:18px;">Thirst levels</h3>
        <ul>${thirstList}</ul>
        ${thirst.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="thirst" data-pet="${pet.entry_id}">${thirstExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}

        <h3 style="margin-top:18px;">Appetite levels</h3>
        <ul>${appetiteList}</ul>
        ${appetite.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="appetite" data-pet="${pet.entry_id}">${appetiteExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}
      </div>
    `;
  }

  renderStat(title, sensor, type = 'normal') {
    const value = sensor ? sensor.state : 'N/A';
    const borderColor = type === 'warning' && parseInt(value) > 0 ? '#ff9800' : 'var(--primary-color)';

    return `
      <div class="stat-card" style="border-left-color: ${borderColor}">
        <h3>${title}</h3>
        <div class="stat-value">${value}</div>
        ${sensor && sensor.attributes?.unit_of_measurement ?
          `<div class="stat-subtext">${sensor.attributes.unit_of_measurement}</div>` : ''}
      </div>
    `;
  }

  getPets() {
    return this._configEntries.map(entry => ({
      entry_id: entry.entry_id,
      name: entry.title,
      type: entry.data?.pet_type || 'other'
    }));
  }

  getSelectedPet() {
    const pets = this.getPets();
    return pets.find(pet => pet.entry_id === this._selectedPetId);
  }

  getPetIcon(type) {
    const icons = {
      'cat': '🐱',
      'dog': '🐶',
      'other': '🐾'
    };
    return icons[type] || icons.other;
  }

  getPetSensors(entryId) {
    const states = this.hass?.states || {};
    const sensors = {};

    // Get the pet name from the config entry
    const configEntry = this._configEntries.find(e => e.entry_id === entryId);
    if (!configEntry) {
      console.warn('Could not find config entry:', entryId);
      return sensors;
    }

    const petName = configEntry.title.toLowerCase().replace(/\s+/g, '_');

    // Looking for sensors for pet: use config entry title as prefix

    // Find all sensors for this pet by matching pet name in entity_id or pet attribute
    Object.keys(states).forEach(entityId => {
      if (entityId.startsWith('sensor.')) {
        const entity = states[entityId];

        // Check if this sensor belongs to our pet
        const belongsToPet =
          entityId.startsWith(`sensor.${petName}_`) ||
          entity.attributes?.pet === configEntry.title;

        if (belongsToPet) {
          // Extract the sensor key by removing the pet name prefix
          let key = entityId.split('.')[1];
          if (key.startsWith(petName + '_')) {
            key = key.substring(petName.length + 1);
          }

          sensors[key] = entity;
        }
      }
    });
    return sensors;
  }

  attachEventListeners() {
    // Pet selector
    const petSelect = this.querySelector('#pet-select');
    if (petSelect) {
      petSelect.addEventListener('change', (e) => {
        this._selectedPetId = e.target.value;
        this.render();
      });
    }

    // Navigation buttons
    this.querySelectorAll('.nav-button').forEach(button => {
      button.addEventListener('click', () => {
        this._currentView = button.dataset.view;
        this.render();
      });
    });

    // Show more/less buttons
    this.querySelectorAll('.show-more-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.dataset.section;
        const petId = button.dataset.pet;
        const key = petId ? `${section}:${petId}` : section;
        this._expandedSections[key] = !this._expandedSections[key];
        this.render();
      });
    });

    // Action buttons

    // Visit action buttons
    this.querySelectorAll('.visit-action-btn').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        const visitId = button.dataset.visitId;
        this.handleVisitAction(action, visitId);
      });
    });
    this.querySelectorAll('.action-button').forEach(button => {
      button.addEventListener('click', () => {
        this.handleAction(button.dataset.action);
      });
    });

    // Registered medication quick-log buttons
    this.querySelectorAll('.log-registered-med').forEach(button => {
      button.addEventListener('click', async () => {
        const pet = this.getSelectedPet();
        if (!pet) return;
        const medId = button.dataset.medId;
        const name = button.dataset.medName;
        const dosage = button.dataset.dosage;
        const unit = button.dataset.unit;
        if (!medId) {
          alert('Medication not configured with an ID. Open integration settings to configure this medication before logging.');
          return;
        }
        // Open modal to allow time/dose adjustments similar to bathroom visit modal
        this.showLogMedicationDialog(pet, { medication_id: medId, medication_name: name, dosage, unit });
      });
    });
  }

  handleAction(action) {
    const pet = this.getSelectedPet();
    if (!pet) return;

    // For now, just call the service - we can add dialogs later
    switch (action) {
      case 'log-bathroom':
        this.showLogBathroomDialog(pet);
        break;

        break;
      case 'log-medication':
        {
          const name = prompt('Medication name:');
          if (!name) return;
          const notes = prompt('Notes (optional):');
          const payload = {
            config_entry_id: pet.entry_id,
            medication_name: name,
          };
          if (notes) payload.notes = notes;
          this.callService('log_medication', payload);
        }
        break;
      case 'log-meal':
        {
          const amt = prompt('Meal amount/description (e.g. small/normal/large):', 'normal');
          this.callService('log_meal', {
            config_entry_id: pet.entry_id,
            amount: amt || 'normal'
          });
        }
        break;
      case 'log-drink':
        {
          const dAmt = prompt('Drink amount (e.g. 50ml):', '');
          this.callService('log_drink', {
            config_entry_id: pet.entry_id,
            amount: dAmt || ''
          });
        }
        break;
      case 'log-weight':
        {
          const weight = prompt('Enter weight in grams:');
          if (weight) {
            this.callService('log_weight', {
              config_entry_id: pet.entry_id,
              weight_grams: parseInt(weight)
            });
          }
        }
        break;
      case 'log-vomit':
        {
          const vType = prompt('Vomit type (e.g. food, bile, foam):');
          if (!vType) return;
          const vNotes = prompt('Notes (optional):');
          this.callService('log_vomit', {
            config_entry_id: pet.entry_id,
            vomit_type: vType,
            notes: vNotes || ''
          });
        }
        break;
    }
  }

  async handleVisitAction(action, visitId) {
    // Check both regular visits and unknown visits
    let visit = this._visits.find(v => v.visit_id === visitId);
    const unknownVisit = !visit && this._unknownVisits && this._unknownVisits.find(v => v.visit_id === visitId);
    if (unknownVisit) {
      visit = unknownVisit;
    }
    
    if (!visit) {
      alert('Visit not found');
      return;
    }

    try {
      switch (action) {
        case 'confirm':
          await this.hass.callService('pet_health', 'confirm_visit', {
            visit_id: visitId
          });
          alert('✅ Visit confirmed!');
          await this.loadVisits();
          if (unknownVisit) await this.loadUnknownVisits();
          break;

        case 'reassign':
          const pets = this.getPets();
          const petOptions = pets.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
          const petChoice = prompt(`Reassign to which pet?\n${petOptions}\n\nEnter number:`);
          if (petChoice) {
            const selectedPet = pets[parseInt(petChoice) - 1];
            if (selectedPet) {
              await this.hass.callService('pet_health', 'reassign_visit', {
                visit_id: visitId,
                config_entry_id: selectedPet.entry_id
              });
              alert(`✅ Visit reassigned to ${selectedPet.name}!`);
              await this.loadVisits();
              if (unknownVisit) await this.loadUnknownVisits();
            }
          }
          break;

        case 'amend':
          this.showAmendDialog(visit);
          break;

        case 'delete':
          if (confirm('Are you sure you want to delete this visit?')) {
            await this.hass.callService('pet_health', 'delete_visit', {
              visit_id: visitId
            });
            alert('✅ Visit deleted!');
            await this.loadVisits();
            if (unknownVisit) await this.loadUnknownVisits();
          }
          break;
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  }

  showAmendDialog(visit) {
    const didPee = prompt(`Did pee? Current: ${visit.did_pee ? 'Yes' : 'No'}\nEnter: yes/no`, visit.did_pee ? 'yes' : 'no');
    const didPoop = prompt(`Did poop? Current: ${visit.did_poop ? 'Yes' : 'No'}\nEnter: yes/no`, visit.did_poop ? 'yes' : 'no');

    let poopConsistencies = null;
    let poopColor = null;
    let urineAmount = null;

    if (didPoop?.toLowerCase() === 'yes') {
      const consistencyOptions = '1. Normal\n2. Soft\n3. Hard\n4. Diarrhea\n5. Liquid';
      const consistency = prompt(`Poop consistency:\n${consistencyOptions}\n\nEnter number(s) separated by comma:`);
      if (consistency) {
        const map = ['normal', 'soft', 'hard', 'diarrhea', 'liquid'];
        poopConsistencies = consistency.split(',').map(n => map[parseInt(n.trim()) - 1]).filter(Boolean);
      }

      const colorOptions = '1. Brown\n2. Dark\n3. Light\n4. Yellow\n5. Green\n6. Red\n7. Black';
      const color = prompt(`Poop color:\n${colorOptions}\n\nEnter number:`);
      if (color) {
        const colorMap = ['brown', 'dark', 'light', 'yellow', 'green', 'red', 'black'];
        poopColor = colorMap[parseInt(color) - 1];
      }
    }

    if (didPee?.toLowerCase() === 'yes') {
      const amountOptions = '1. Small\n2. Normal\n3. Large';
      const amount = prompt(`Urine amount:\n${amountOptions}\n\nEnter number:`);
      if (amount) {
        const amountMap = ['small', 'normal', 'large'];
        urineAmount = amountMap[parseInt(amount) - 1];
      }
    }

    const notes = prompt('Notes (optional):', visit.notes || '');

    const amendData = {
      visit_id: visit.visit_id
    };

    if (didPee) amendData.did_pee = didPee.toLowerCase() === 'yes';
    if (didPoop) amendData.did_poop = didPoop.toLowerCase() === 'yes';
    if (poopConsistencies) amendData.poop_consistencies = poopConsistencies;
    if (poopColor) amendData.poop_color = poopColor;
    if (urineAmount) amendData.urine_amount = urineAmount;
    if (notes !== null) amendData.notes = notes;

    this.hass.callService('pet_health', 'amend_visit', amendData)
      .then(() => {
        alert('✅ Visit amended!');
        return this.loadVisits();
      })
      .catch(err => alert('❌ Error: ' + err.message));
  }

    showLogBathroomDialog(pet) {
      // Remove existing dialog if present
      const existing = this.querySelector('.ph-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'ph-modal';
      modal.innerHTML = `
        <style>
          .ph-modal { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; z-index:10000; }
          .ph-modal-backdrop { position:absolute; inset:0; background: rgba(0,0,0,0.45); }
          .ph-modal-card { position:relative; background: var(--card-background-color); color: var(--primary-text-color); border-radius:8px; padding:20px; width:520px; box-shadow: var(--ha-card-box-shadow); z-index:10001; }
          .ph-modal-card h3 { margin:0 0 8px 0; }
          .ph-form-row { display:flex; gap:8px; margin-bottom:8px; align-items:center; }
          .ph-form-row > label { min-width:120px; font-size:13px; color:var(--secondary-text-color); }
          .ph-form-row input[type="text"], .ph-form-row textarea, .ph-form-row select { flex:1; padding:6px 8px; }
          .ph-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
          .ph-checkbox-group { display:flex; gap:8px; align-items:center; }
          .ph-small { font-size:12px; color:var(--secondary-text-color); }
        </style>
        <div class="ph-modal-backdrop"></div>
        <div class="ph-modal-card" role="dialog" aria-modal="true">
          <h3>Log bathroom visit for ${pet.name}</h3>
          <div class="ph-form-row">
            <label>When</label>
            <input id="ph-ts" type="datetime-local" />
          </div>
          <div class="ph-form-row">
            <label></label>
            <div class="ph-checkbox-group">
              <label><input id="ph-peeing" type="checkbox" checked /> Pee</label>
              <label><input id="ph-pooping" type="checkbox" /> Poop</label>
            </div>
          </div>
          <div class="ph-form-row" id="ph-poop-details" style="display:none;">
            <label>Poop details</label>
            <div style="flex:1; display:flex; gap:8px;">
              <select id="ph-poop-consistency" multiple style="min-width:140px;">
                <option value="normal">Normal</option>
                <option value="soft">Soft</option>
                <option value="hard">Hard</option>
                <option value="diarrhea">Diarrhea</option>
                <option value="liquid">Liquid</option>
              </select>
              <select id="ph-poop-color">
                <option value="">Color (optional)</option>
                <option value="brown">Brown</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="black">Black</option>
              </select>
            </div>
          </div>
          <div class="ph-form-row">
            <label>Urine amount</label>
            <select id="ph-urine-amount">
              <option value="">(unspecified)</option>
              <option value="small">Small</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div class="ph-form-row">
            <label>Notes</label>
            <textarea id="ph-notes" rows="3" placeholder="Optional notes (e.g., unusual behavior)"></textarea>
          </div>

          <div class="ph-actions">
            <button class="action-button ph-cancel">Cancel</button>
            <button class="action-button ph-submit">Log visit</button>
          </div>
          <div class="ph-small" style="margin-top:8px;">Tip: set the time if logging a past visit, or leave as now</div>
        </div>
      `;

      // Append to document.body so re-renders of the panel don't remove it
      try {
        document.body.appendChild(modal);
      } catch (e) {
        // Fallback to appending to the panel element
        this.appendChild(modal);
      }

      console.log('pet-health: showLogBathroomDialog for', pet.entry_id);

      // Set default ts to now in local datetime-local format
      const tsInput = modal.querySelector('#ph-ts');
      const toLocalDateTime = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const mins = pad(d.getMinutes());
        return `${year}-${month}-${day}T${hours}:${mins}`;
      };
      tsInput.value = toLocalDateTime(new Date());

      const pee = modal.querySelector('#ph-peeing');
      const poop = modal.querySelector('#ph-pooping');
      const poopDetails = modal.querySelector('#ph-poop-details');
      pee.addEventListener('change', () => {});
      poop.addEventListener('change', () => {
        poopDetails.style.display = poop.checked ? 'flex' : 'none';
      });

      modal.querySelector('.ph-cancel').addEventListener('click', () => this.closeDialog(modal));
      modal.querySelector('.ph-submit').addEventListener('click', async () => {
        const tsVal = modal.querySelector('#ph-ts').value;
        const didPee = modal.querySelector('#ph-peeing').checked;
        const didPoop = modal.querySelector('#ph-pooping').checked;
        const poopCons = Array.from(modal.querySelector('#ph-poop-consistency').selectedOptions).map(o => o.value);
        const poopColor = modal.querySelector('#ph-poop-color').value || null;
        const urineAmt = modal.querySelector('#ph-urine-amount').value || null;
        const notes = modal.querySelector('#ph-notes').value || '';

        const payload = {
          config_entry_id: pet.entry_id,
          did_pee: !!didPee,
          did_poop: !!didPoop,
          notes: notes || undefined,
        };
        // logged_at: convert local datetime-local to ISO (service expects `logged_at`)
        if (tsVal) {
          const iso = new Date(tsVal).toISOString();
          payload.logged_at = iso;
        }
        if (poopCons && poopCons.length > 0) payload.poop_consistencies = poopCons;
        if (poopColor) payload.poop_color = poopColor;
        if (urineAmt) payload.urine_amount = urineAmt;

        try {
          await this.callService('log_bathroom_visit', payload);
          this.closeDialog(modal);
          await this.loadVisits(pet.entry_id);
        } catch (err) {
          alert('Error logging visit: ' + err.message);
        }
      });
    }

    closeDialog(modal) {
      if (modal && modal.remove) modal.remove();
    }

  async callService(service, data) {
    try {
      await this.hass.callService('pet_health', service, data);
      alert('✅ Logged successfully!');
      this.render();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  }
}

customElements.define('pet-health-panel', PetHealthPanel);
