import { useEffect, useRef, useState } from 'react';
import { FINAL_QUESTION, VICTORY_LINE } from '../data/constellations';
import type { LeaderboardEntry } from '../game/leaderboard';
import { REDESIGN } from '../game/ruleset';
import { matchesAnswer } from '../game/state';
import { formatDuration } from '../hooks/useNow';
import { LeaderboardList } from './LeaderboardList';

interface Props {
  team: string;
  masterKey: string;
  totalMs: number;
  penaltyMs: number;
  sectorRestarts: number;
  rank: number | null;
  entries: LeaderboardEntry[];
  mine: LeaderboardEntry | null;
  /** Redesign: the look-up question has been answered. */
  finalSolved: boolean;
  onFinalSolved: () => void;
}

export function VictoryScreen(props: Props) {
  const { team, masterKey, totalMs, penaltyMs, sectorRestarts, rank, entries, mine } = props;
  const restarts = sectorRestarts > 0 && `${sectorRestarts} sector ${sectorRestarts === 1 ? 'restart' : 'restarts'}.`;
  return (
    <div className="victory" role="dialog" aria-labelledby="victory-title">
      <div className="victory-main">
        <h2 id="victory-title" className="victory-title">
          MISSION COMPLETE
        </h2>
        <div className="victory-team">CREW {team}</div>
        <div className="victory-label">MASTER KEY</div>
        <div className="victory-key">{masterKey}</div>
        <div className="victory-line">{VICTORY_LINE}</div>
        {REDESIGN ? (
          <FinalQuestion solved={props.finalSolved} onSolved={props.onFinalSolved} />
        ) : (
          <>
            <div className="victory-time">
              FINAL TIME {formatDuration(totalMs)}
              {rank !== null && <span className="victory-rank"> RANK #{rank}</span>}
            </div>
            {(penaltyMs > 0 || sectorRestarts > 0) && (
              <div className="restarts">
                {penaltyMs > 0 && <span className="penalty">Includes +{formatDuration(penaltyMs)} of hint penalties. </span>}
                {restarts}
              </div>
            )}
          </>
        )}
        {REDESIGN && restarts && <div className="restarts">{restarts}</div>}
        {!REDESIGN && <div className="victory-note">Take this key to the final terminal.</div>}
      </div>
      {!REDESIGN && (
        <aside className="victory-board" aria-label="Fastest crews">
          <h3>FASTEST CREWS</h3>
          <LeaderboardList entries={entries} limit={8} highlight={mine} />
        </aside>
      )}
    </div>
  );
}

/**
 * Redesign: one fact the crew looks up after assembling the master key. The confirmed answer is
 * what they take to the final terminal.
 */
function FinalQuestion({ solved, onSolved }: { solved: boolean; onSolved: () => void }) {
  const [value, setValue] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!solved) inputRef.current?.focus();
  }, [solved]);

  if (solved) {
    return (
      <div className="final-question solved" role="status">
        <div className="final-label">FINAL ANSWER CONFIRMED</div>
        <div className="final-answer">{FINAL_QUESTION.answer}</div>
        <div className="victory-note">Take this answer to the final terminal.</div>
      </div>
    );
  }

  return (
    <form
      className="final-question"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        if (matchesAnswer(FINAL_QUESTION.accepted, value)) {
          onSolved();
          return;
        }
        setReply(
          matchesAnswer(FINAL_QUESTION.nearMiss.answers, value)
            ? FINAL_QUESTION.nearMiss.reply
            : `"${value.trim().toUpperCase()}" isn't it. Search it and try again.`,
        );
        setValue('');
      }}
    >
      <label className="final-label" htmlFor="final-answer">
        FINAL QUESTION
      </label>
      <p className="final-prompt">{FINAL_QUESTION.prompt}</p>
      <div className="final-row term-input">
        <input
          id="final-answer"
          ref={inputRef}
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder="TYPE THE ANSWER THEN ENTER"
          aria-describedby={reply ? 'final-reply' : undefined}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="lobby-start">
          CHECK
        </button>
      </div>
      <p id="final-reply" className="final-reply" aria-live="polite">
        {reply ?? ' '}
      </p>
    </form>
  );
}
