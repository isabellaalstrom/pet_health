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
    this._medications = [];
    this._loadingMedications = false;
    this._editingVisitId = null;
    this._medicationsRetries = 0;
    this._storeDump = {};
    this._expandedSections = {};
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
    }
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
          (pd.visits || []).forEach((v) => this._visits.push(v));
          (pd.medications || []).forEach((m) => this._medications.push(m));
        });

        // Sort descending by timestamp
        this._visits.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        this._medications.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      } catch (err) {
        console.debug('Failed to load store dump:', err);
        this._storeDump = {};
      }
      // Config entries loaded

      // Select first pet if none selected
      if (!this._selectedPetId && this._configEntries.length > 0) {
        this._selectedPetId = this._configEntries[0].entry_id;
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

    // Compute unconfirmed visits count for selected pet (for badge)
    const selectedPet = this.getSelectedPet();
    let unconfirmedCount = 0;
    if (selectedPet) {
      const selInternal = this.getPetIdFromEntry(selectedPet.entry_id);
      unconfirmedCount = this._visits.filter(v => v.pet_id === selectedPet.entry_id || v.pet_id === selInternal).filter(v => !v.confirmed).length;
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

    // Load visits when switching to visits view
    if (this._currentView === 'visits' && this._visits.length === 0 && !this._loadingVisits) {
      this.loadVisits();
    }

    // Load medications when switching to medications view
    if (this._currentView === 'medications' && this._medications.length === 0 && !this._loadingMedications) {
      this.loadMedications();
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
            <div class="stat-value">${lastMed ? formatTs(lastMed.timestamp) : 'N/A'}</div>
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
              <button class="action-button" data-action="log-medication">💊 Log Medication</button>
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
    const petVisits = this._visits.filter(
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

    return `
      <div class="content-area">
        <h2>Bathroom Visit History for ${pet.name}</h2>

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

  async loadVisits() {
    if (this._loadingVisits) return;
    this._loadingVisits = true;

    try {
      const result = await this.hass.callWS({
        type: 'pet_health/get_visits'
      });

      this._visits = result.visits || [];

    } catch (err) {
      console.error('Failed to load visits:', err);
      this._visits = [];
    } finally {
      this._loadingVisits = false;
      this.render();
    }
  }

  async loadMedications() {
    if (this._loadingMedications) return;
    this._loadingMedications = true;

    try {
      const result = await this.hass.callWS({
        type: 'pet_health/get_medications'
      });

      this._medications = result.medications || [];
    } catch (err) {
      // If the backend hasn't registered the websocket command yet, retry a few times
      if (err && err.code === 'unknown_command' && this._medicationsRetries < 5) {
        this._medicationsRetries += 1;
        const retryDelay = 300 * this._medicationsRetries; // ms
        setTimeout(() => {
          this._loadingMedications = false;
          this.loadMedications();
        }, retryDelay);
        return;
      }

      console.error('Failed to load medications:', err);
      this._medications = [];
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
            timestamp: m.timestamp || m.given_at || sensor.last_changed || new Date().toISOString(),
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
            timestamp: m.timestamp || m.given_at || sensor.last_changed || new Date().toISOString(),
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
        medsFromSensors.push({
          medication_name: attrs.medication_name || sensor.state || key,
          timestamp: attrs.given_at || sensor.last_changed || new Date().toISOString(),
          dosage: attrs.dosage || '',
          unit: attrs.unit || '',
          notes: attrs.notes || '',
          pet_id: attrs.pet || pet.entry_id,
        });
      }
    });

    // Get store-provided meds either from loaded _medications or from the config entry payload
    let storeMeds = [];
    const configEntry = this._configEntries.find((e) => e.entry_id === pet.entry_id);
    // Prefer authoritative store dump when available
    const petInternalId = this.getPetIdFromEntry(pet.entry_id);
    if (this._storeDump && (this._storeDump[petInternalId] || this._storeDump[pet.entry_id])) {
      const pd = this._storeDump[petInternalId] || this._storeDump[pet.entry_id] || {};
      storeMeds = (pd.medications || []).map((m) => ({
        medication_name: m.medication_name || m.name || m.medication || '',
        timestamp: m.timestamp || m.given_at || new Date().toISOString(),
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
        timestamp: m.timestamp || m.given_at || new Date().toISOString(),
        dosage: m.dosage || m.amount || '',
        unit: m.unit || '',
        notes: m.notes || '',
        pet_id: configEntry.pet_id || pet.entry_id,
      }));
    }

    // Merge: prefer storeMeds, then append sensor meds that are not duplicates
    const merged = [...storeMeds];
    const seen = new Set(storeMeds.map((s) => `${s.medication_name}::${s.timestamp}`));
    medsFromSensors.forEach((s) => {
      const key = `${s.medication_name}::${s.timestamp}`;
      if (!seen.has(key)) {
        merged.push(s);
        seen.add(key);
      }
    });

    const meds = merged;

    const medsKey = `medications:${pet.entry_id}`;
    const medsExpanded = !!this._expandedSections[medsKey];
    const medsShown = medsExpanded ? meds : meds.slice(0, 5);

    return `
      <div class="content-area">
        <h2>Medications for ${pet.name}</h2>
        ${this.renderMedicationsTable(medsShown)}
        ${meds.length > 5 ? `<div style="margin-top:8px"><button class="show-more-btn" data-section="medications" data-pet="${pet.entry_id}">${medsExpanded ? 'Show less' : 'Show more'}</button></div>` : ''}
        <div style="margin-top:16px;">
          <button class="action-button" data-action="log-medication">💊 Log Medication</button>
        </div>
      </div>
    `;
  }

  renderMedicationsTable(meds) {
    if (!meds || meds.length === 0) {
      return `<p>No medication records found</p>`;
    }

    const rows = meds
      .map(
        (m) => `
      <tr>
        <td style="padding: 8px;">${m.medication_name}</td>
        <td style="padding: 8px;">${this.formatTimestampEuropean(m.timestamp)}</td>
        <td style="padding: 8px;">${m.dosage || ''} ${m.unit || ''}</td>
        <td style="padding: 8px;">${m.notes || ''}</td>
      </tr>`
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
      button.addEventListener('click', (e) => {
        this._currentView = e.target.dataset.view;
        this.render();
      });
    });

    // Show more/less buttons
    this.querySelectorAll('.show-more-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        const petId = e.target.dataset.pet;
        const key = `${section}:${petId}`;
        this._expandedSections[key] = !this._expandedSections[key];
        this.render();
      });
    });

    // Action buttons

    // Visit action buttons
    this.querySelectorAll('.visit-action-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const visitId = e.target.dataset.visitId;
        this.handleVisitAction(action, visitId);
      });
    });
    this.querySelectorAll('.action-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.handleAction(e.target.dataset.action);
      });
    });
  }

  handleAction(action) {
    const pet = this.getSelectedPet();
    if (!pet) return;

    // For now, just call the service - we can add dialogs later
    switch (action) {
      case 'log-bathroom':
        this.callService('log_bathroom_visit', {
          config_entry_id: pet.entry_id,
          did_pee: true,
          did_poop: false
        });
        break;
      case 'log-medication':
        {
          const name = prompt('Medication name:');
          if (!name) return;
          const dosage = prompt('Dosage (number, optional):');
          const unit = prompt('Unit (e.g. mg, ml, g) (optional):');
          const notes = prompt('Notes (optional):');
          const payload = {
            config_entry_id: pet.entry_id,
            medication_name: name,
          };
          if (dosage) payload.dosage = isNaN(parseFloat(dosage)) ? dosage : parseFloat(dosage);
          if (unit) payload.unit = unit;
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
    const visit = this._visits.find(v => v.visit_id === visitId);
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
