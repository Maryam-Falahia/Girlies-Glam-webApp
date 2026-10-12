import { createRoot } from 'react-dom/client';

import App from './App';
import { PreferencesProvider } from './lib/preferences';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <PreferencesProvider>
    <App />
  </PreferencesProvider>,
);
