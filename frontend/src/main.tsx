import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ColorSchemeProvider } from './hooks/useColorScheme';
import { GameProvider } from './state/GameContext';
import { applyColorScheme, readColorScheme } from './utils/colorScheme';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/admin.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден корневой элемент #root');
}

applyColorScheme(readColorScheme());

// Заставка из index.html убирается только сейчас — так между HTML и первым
// кадром React не возникает белой вспышки.
document.getElementById('boot')?.remove();

createRoot(container).render(
  <StrictMode>
    <ColorSchemeProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </ColorSchemeProvider>
  </StrictMode>,
);
