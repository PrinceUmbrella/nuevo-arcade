import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './index.css';
import App from './App.tsx';
import { NavigatorView } from './components/NavigatorView.tsx';

const view = new URLSearchParams(window.location.search).get('view');
const Root = view === 'navigator' ? NavigatorView : App;
if (view === 'navigator') document.documentElement.classList.add('page-view');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
