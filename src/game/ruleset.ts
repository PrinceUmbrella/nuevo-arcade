/**
 * Which rule set this page load runs. The redesign is the default; `?rules=classic` brings back
 * the original rules and copy so both versions can be compared side by side.
 */
export type Ruleset = 'redesign' | 'classic';

const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);

export const RULESET: Ruleset = params.get('rules') === 'classic' ? 'classic' : 'redesign';
export const REDESIGN = RULESET === 'redesign';

/**
 * `?aim=free` (redesign only): SPACE with nothing armed arms the cell under the reticle, and the
 * next SPACE fires at it. Without it, players arm by typing a coordinate.
 */
export const FREE_AIM = REDESIGN && params.get('aim') === 'free';
