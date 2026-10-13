/** Parse un nombre saisi en acceptant la virgule décimale. */
export const num = (s: string) => parseFloat(s.replace(',', '.'));

export const round = (n: number, decimals = 0) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export const signed = (n: number, decimals = 1) => `${n > 0 ? '+' : ''}${round(n, decimals)}`;
