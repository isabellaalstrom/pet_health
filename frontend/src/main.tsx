import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import type { HomeAssistant } from './types';

// Create a Web Component wrapper for Home Assistant integration
class PetHealthPanel extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private _hass: HomeAssistant | null = null;

  connectedCallback() {
    // Create a mount point for React directly in the element (no Shadow DOM)
    const mountPoint = document.createElement('div');
    mountPoint.id = 'react-root';
    mountPoint.style.minHeight = '100vh';
    mountPoint.style.width = '100%';
    this.appendChild(mountPoint);

    // Initialize React root and render once
    this.root = ReactDOM.createRoot(mountPoint);
    if (this._hass) {
      this.renderApp();
    }
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;

    // Only render if we haven't rendered yet
    if (this.root && !this.querySelector('#react-root > *')) {
      this.renderApp();
    }
  }

  get hass(): HomeAssistant | null {
    return this._hass;
  }

  private renderApp() {
    if (this.root && this._hass) {
      this.root.render(
        <React.StrictMode>
          <App hass={this._hass} />
        </React.StrictMode>
      );
    }
  }
}

// Register the custom element
customElements.define('pet-health-panel', PetHealthPanel);

export { PetHealthPanel };
