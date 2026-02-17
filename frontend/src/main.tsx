import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import type { HomeAssistant } from './types';

// Create a Web Component wrapper for Home Assistant integration
class PetHealthPanel extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private _hass: HomeAssistant | null = null;

  connectedCallback() {
    // Create a mount point for React
    const mountPoint = document.createElement('div');
    mountPoint.id = 'react-root';
    this.attachShadow({ mode: 'open' }).appendChild(mountPoint);
    
    // Render React app
    this.root = ReactDOM.createRoot(mountPoint);
    this.renderApp();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.renderApp();
  }

  get hass(): HomeAssistant | null {
    return this._hass;
  }

  private renderApp() {
    if (this.root) {
      this.root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }
  }
}

// Register the custom element
customElements.define('pet-health-panel', PetHealthPanel);

export { PetHealthPanel };
