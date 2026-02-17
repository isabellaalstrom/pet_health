# Pet Health Panel - React Frontend

This directory contains the React-based frontend for the Pet Health integration panel.

## Structure

```
frontend/
├── src/
│   ├── components/      # React components (future modularization)
│   ├── hooks/          # Custom React hooks
│   │   ├── useHomeAssistant.ts  # Hook for HA connection
│   │   ├── usePets.ts          # Hook for pet data
│   │   └── useVisits.ts        # Hook for visit data
│   ├── services/       # API services
│   │   └── petHealthApi.ts     # Pet Health API wrapper
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts            # Core types
│   ├── App.tsx         # Main application component
│   ├── App.css         # Application styles
│   └── main.tsx        # Entry point & Web Component wrapper
├── index.html          # Development HTML
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Build configuration
```

## Development

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

This starts a Vite development server. Note that full integration with Home Assistant features requires building and testing within Home Assistant.

### Build for Production

```bash
npm run build
```

Outputs the bundled `pet-health-panel.js` to `../www/` directory.

### Type Checking

```bash
npm run type-check
```

## Architecture

### Web Component Wrapper

The React app is wrapped in a Web Component (`pet-health-panel`) to integrate with Home Assistant's custom panel system. The wrapper:

- Receives the `hass` object from Home Assistant
- Renders the React app in a Shadow DOM
- Manages lifecycle (mount/unmount)

### Home Assistant Integration

The app uses:
- **WebSocket API** for data fetching (pets, visits, medications)
- **Service calls** for actions (logging visits, medications, etc.)
- **Event subscriptions** for auto-refresh on data updates

### State Management

Currently uses React hooks (`useState`, `useEffect`) with custom hooks for:
- `useHomeAssistant` - HA connection management
- `usePets` - Pet data fetching
- `useVisits` - Visit data fetching

### Styling

Uses CSS with Home Assistant theme variables for dark/light mode support:
- `--primary-color`
- `--card-background-color`
- `--primary-text-color`
- etc.

## Future Enhancements

The current implementation provides a simplified but functional UI with:
- Dashboard view with basic stats
- Visits list view
- Placeholder views for Medications, Health, and Nutrition

Future work should focus on:
1. Adding full functionality for Medications, Health, and Nutrition views
2. Implementing comprehensive modals for logging events
3. Adding edit/delete/amend capabilities
4. Implementing the "Unknown Visits" handling
5. Adding more interactive charts and visualizations
6. Improving loading and error states
7. Adding unit tests

## Notes

- The build outputs a single bundled JS file (IIFE format) for Home Assistant compatibility
- Styles are inline CSS in the bundle to work within the Shadow DOM
- The app maintains compatibility with existing backend WebSocket and service APIs
