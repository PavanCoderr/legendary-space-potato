import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/StoreProvider';
import { applyTheme, loadStoredTheme } from './state/theme';
import './styles.css';

// Paint the right theme before React mounts, so there is no flash of the wrong background.
applyTheme(loadStoredTheme());

const container = document.getElementById('root');
if (!container) {
  throw new Error('QubitVerse could not find its mount point (#root).');
}

createRoot(container).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
