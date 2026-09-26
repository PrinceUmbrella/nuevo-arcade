import { useEffect, useRef, useState } from 'react';
import { TEAM_NAME_MAX } from '../game/state';

export function Lobby({ onStart }: { onStart: (team: string) => void }) {
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
          Three firewalls. Decode each constellation, shoot only its stars, and assemble the master key.
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
        <p className="lobby-note">Wrong shots lock the cannon. Requested hints take time to decrypt.</p>
      </div>
    </div>
  );
}
