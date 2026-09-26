import { useEffect, useRef, useState } from 'react';
import type { LeaderboardEntry } from '../game/leaderboard';
import { REDESIGN } from '../game/ruleset';
import { TEAM_NAME_MAX } from '../game/state';
import { LeaderboardList } from './LeaderboardList';

export function Lobby({ entries, onStart }: { entries: LeaderboardEntry[]; onStart: (team: string) => void }) {
  const [team, setTeam] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="lobby" role="dialog" aria-labelledby="lobby-title">
      <div className="lobby-main">
        <h1 id="lobby-title" className="lobby-title">
          THE CONSTELLATION GRID
        </h1>
        <p className="lobby-brief">
          {REDESIGN
            ? 'Three firewalls. Decode each constellation, shoot only its stars, and assemble the master key.'
            : 'Three firewalls. Decode each constellation, shoot only its stars, and assemble the master key. Fastest crew tops the board.'}
        </p>
        <form
          className="term-input lobby-form"
          onSubmit={(e) => {
            e.preventDefault();
            onStart(team);
          }}
        >
          <label htmlFor="team">&gt; CREW NAME</label>
          <div className="lobby-row">
            <input
              id="team"
              ref={inputRef}
              value={team}
              maxLength={TEAM_NAME_MAX}
              autoComplete="off"
              spellCheck={false}
              placeholder="TYPE YOUR TEAM NAME"
              onChange={(e) => setTeam(e.target.value)}
            />
            <button type="submit" className="lobby-start">
              START MISSION
            </button>
          </div>
        </form>
        <p className="lobby-note">
          {REDESIGN
            ? "There's no clock, so take your time. Play the three sectors in any order. Hints are free. Wrong answers cost a shield."
            : 'The mission clock starts when you press Start. Requested hints add 1:00.'}
        </p>
      </div>
      {!REDESIGN && (
        <aside className="lobby-board" aria-label="Fastest crews">
          <h2>FASTEST CREWS</h2>
          <LeaderboardList entries={entries} limit={8} />
        </aside>
      )}
    </div>
  );
}
