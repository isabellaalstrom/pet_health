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
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.isConnected) {
      return;
    }
    this.render();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this.hass) {
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
    
    return `
      <div class="content-area">
        <h2>Overview for ${pet.name}</h2>
        
        <div class="stats-grid">
          ${this.renderStat('Last Bathroom Visit', sensors.last_bathroom_visit)}
          ${this.renderStat('Daily Visits', sensors.daily_visit_count)}
          ${this.renderStat('Hours Since Last Visit', sensors.hours_since_last_visit)}
          ${this.renderStat('Unconfirmed Visits', sensors.unconfirmed_visits_count, 'warning')}
        </div>

        <div class="action-section">
          <h2>Quick Actions</h2>
          <div class="action-buttons">
            <button class="action-button" data-action="log-bathroom">
              🚽 Log Bathroom Visit
            </button>
            <button class="action-button" data-action="log-medication">
              💊 Log Medication
            </button>
            <button class="action-button" data-action="log-meal">
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
    return `
      <div class="content-area">
        <h2>Bathroom Visit History</h2>
        <p>Coming soon: Detailed visit history and management</p>
      </div>
    `;
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
    const configEntries = this.hass?.config_entries || [];
    return Object.values(configEntries)
      .filter(entry => entry.domain === 'pet_health')
      .map(entry => ({
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
    
    // Find all sensors for this pet
    Object.keys(states).forEach(entityId => {
      if (entityId.startsWith('sensor.') && states[entityId].attributes?.pet_id) {
        const entity = states[entityId];
        // Match sensors by comparing config entry id from entity attributes
        // For now, we'll use a simpler approach - match by pet name in entity_id
        const entryName = this.getSelectedPet()?.name?.toLowerCase().replace(/\s+/g, '_');
        if (entityId.includes(entryName)) {
          const key = entityId.split('.')[1].replace(`${entryName}_`, '');
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

    // Action buttons
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
