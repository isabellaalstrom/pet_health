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
    this._editingVisitId = null;
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

      // Debug: Log config entry structure
      console.log('Config entries loaded:', this._configEntries.length);
      if (this._configEntries.length > 0) {
        console.log('First entry structure:', JSON.stringify(this._configEntries[0], null, 2));
      }

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
                🚽 Bathroom Visits
              </button>
              <button class="nav-button ${this._currentView === 'medications' ? 'active' : ''}" data-view="medications">
                💊 Medications
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

    switch (this._currentView) {
      case 'dashboard':
        return this.renderDashboard(pet);
      case 'visits':
        return this.renderVisits(pet);
      case 'medications':
        return this.renderMedications(pet);
      case 'health':
        return this.renderHealth(pet);
      default:
        return '';
    }
  }

  renderDashboard(pet) {
    const sensors = this.getPetSensors(pet.entry_id);

    // Debug: log available sensors
    console.log('Pet:', pet.name, 'Sensors found:', Object.keys(sensors));

    return `
      <div class="content-area">
        <h2>Overview for ${pet.name}</h2>

        <div class="stats-grid">
          ${this.renderStat('Last Bathroom Visit', sensors.last_bathroom_visit)}
          ${this.renderStat('Daily Visits', sensors.daily_bathroom_visits)}
          ${this.renderStat('Hours Since Last Visit', sensors.hours_since_last_bathroom_visit)}
          ${this.renderStat('Unconfirmed Visits', sensors.unconfirmed_bathroom_visits, 'warning')}
              🍽️ Log Meal
            </button>
            <button class="action-button" data-action="log-weight">
              ⚖️ Log Weight
            </button>
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
    console.log('Filtering visits for pet:', pet.name);
    console.log('Pet entry_id:', pet.entry_id);
    console.log('Pet internal pet_id:', petInternalId);
    console.log('Total visits loaded:', this._visits.length);
    console.log('All visit pet_ids:', this._visits.map(v => v.pet_id));

    const petVisits = this._visits.filter(v => v.pet_id === pet.entry_id || v.pet_id === petInternalId);
    console.log('Filtered visits for this pet:', petVisits.length);

    const unconfirmedVisits = petVisits.filter(v => !v.confirmed);
    const confirmedVisits = petVisits.filter(v => v.confirmed).slice(0, 20); // Show last 20

    console.log('Unconfirmed:', unconfirmedVisits.length, 'Confirmed:', confirmedVisits.length);

    return `
      <div class="content-area">
        <h2>Bathroom Visit History for ${pet.name}</h2>

        ${unconfirmedVisits.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h3 style="color: #ff9800; margin-bottom: 16px;">⚠️ Unconfirmed Visits (${unconfirmedVisits.length})</h3>
            ${this.renderVisitsTable(unconfirmedVisits, true)}
          </div>
        ` : ''}

        <div>
          <h3 style="margin-bottom: 16px;">✅ Recent Visits</h3>
          ${confirmedVisits.length > 0 ?
            this.renderVisitsTable(confirmedVisits, false) :
            '<p style="color: var(--secondary-text-color);">No confirmed visits yet</p>'}
        </div>
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
    const timeStr = timestamp.toLocaleString();
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
                style="padding: 6px 12px; border: none; border-radius: 4px; background: #4caf50; color: white; cursor: pointer; font-size: 12px;">
                ✓ Confirm
              </button>
              <button class="visit-action-btn" data-action="amend" data-visit-id="${visit.visit_id}"
                style="padding: 6px 12px; border: none; border-radius: 4px; background: #2196f3; color: white; cursor: pointer; font-size: 12px;">
                ✏️ Amend
              </button>
              <button class="visit-action-btn" data-action="reassign" data-visit-id="${visit.visit_id}"
                style="padding: 6px 12px; border: none; border-radius: 4px; background: #ff9800; color: white; cursor: pointer; font-size: 12px;">
                🔄 Reassign
              </button>
              <button class="visit-action-btn" data-action="delete" data-visit-id="${visit.visit_id}"
                style="padding: 6px 12px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer; font-size: 12px;">
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
      console.log('Loaded visits:', this._visits.length);

    } catch (err) {
      console.error('Failed to load visits:', err);
      this._visits = [];
    } finally {
      this._loadingVisits = false;
      this.render();
    }
  }

  renderMedications(pet) {
    return `
      <div class="content-area">
        <h2>Medication Tracking</h2>
        <p>Coming soon: Medication schedule and history</p>
      </div>
    `;
  }

  renderHealth(pet) {
    return `
      <div class="content-area">
        <h2>Health & Weight Tracking</h2>
        <p>Coming soon: Weight charts and health monitoring</p>
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

    console.log('Looking for sensors for pet:', configEntry.title, 'entity prefix:', petName);

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
          console.log('Found sensor:', entityId, 'key:', key);
        }
      }
    });
    console.log('Finished scanning sensors for pet:', sensors);
    console.log('Total sensors found:', Object.keys(sensors).length);
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
        alert('Please select medication from the integration options first');
        break;
      case 'log-meal':
        this.callService('log_meal', {
          config_entry_id: pet.entry_id,
          amount: 'normal'
        });
        break;
      case 'log-weight':
        const weight = prompt('Enter weight in grams:');
        if (weight) {
          this.callService('log_weight', {
            config_entry_id: pet.entry_id,
            weight_grams: parseInt(weight)
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
