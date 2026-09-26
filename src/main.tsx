import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './index.css';
import App from './App.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { NavigatorView } from './components/NavigatorView.tsx';
import { REDESIGN } from './game/ruleset';

const param = new URLSearchParams(window.location.search).get('view');
// The leaderboard screen belongs to the classic rules; the redesign has no clock or rankings.
const view = param === 'leaderboard' && REDESIGN ? null : param;
const Root = view === 'navigator' ? NavigatorView : view === 'leaderboard' ? LeaderboardView : App;
if (view === 'navigator' || view === 'leaderboard') document.documentElement.classList.add('page-view');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
