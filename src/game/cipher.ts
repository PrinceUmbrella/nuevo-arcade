/** Vigenère cipher over A-Z. Case and non-letters are preserved; the key advances only on letters. */
export function vigenere(text: string, key: string, decrypt = false): string {
  const shifts = key
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .map((c) => c.charCodeAt(0) - 65);
  if (shifts.length === 0) return text;
  let i = 0;
  return text.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    const shift = shifts[i++ % shifts.length] * (decrypt ? -1 : 1);
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

export const normalizeKey = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, '');
