/**
 * Which rule set this page load runs. The redesign is the default; `?rules=classic` brings back
 * the original rules and copy so both versions can be compared side by side.
 */
export type Ruleset = 'redesign' | 'classic';

const param = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('rules');

export const RULESET: Ruleset = param === 'classic' ? 'classic' : 'redesign';
export const REDESIGN = RULESET === 'redesign';
