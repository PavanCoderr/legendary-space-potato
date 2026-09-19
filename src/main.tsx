import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/StoreProvider';
import { applyTheme, loadStoredTheme } from './state/theme';
import { bootstrapLessons } from './services/api';
import './styles.css';

// Paint the right theme before React mounts, so there is no flash of the wrong background.
applyTheme(loadStoredTheme());

// E4b: In HTTP mode, install the backend-served curriculum BEFORE first render.
// Use Promise.race with a timeout so a downed backend costs at most 1.5 s
// — fetchLessons falls back to the bundled curriculum on its own.
const container = document.getElementById('root');
if (!container) {
  throw new Error('QubitVerse could not find its mount point (#root).');
}

await Promise.race([
  bootstrapLessons(),
  new Promise(r => setTimeout(r, 1500)),
]);

createRoot(container).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
