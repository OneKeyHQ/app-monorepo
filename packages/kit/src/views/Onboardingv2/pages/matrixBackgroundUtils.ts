const MATRIX_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateMatrixPool(
  count: number,
  charsPerItem: number,
): string[] {
  const pool: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let text = '';
    for (let j = 0; j < charsPerItem; j += 1) {
      text +=
        MATRIX_CHARSET[Math.floor(Math.random() * MATRIX_CHARSET.length)];
    }
    pool.push(text);
  }
  return pool;
}

export type IMatrixBackgroundProps = {
  lineCount?: number;
  charsPerLine?: number;
  updateInterval?: number;
};
