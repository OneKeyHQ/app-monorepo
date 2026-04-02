import { useRef } from 'react';

const MATRIX_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateMatrixPool(count: number, charsPerItem: number): string[] {
  const pool: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let text = '';
    for (let j = 0; j < charsPerItem; j += 1) {
      text += MATRIX_CHARSET[Math.floor(Math.random() * MATRIX_CHARSET.length)];
    }
    pool.push(text);
  }
  return pool;
}

// Lazy-initialized pool via useRef to avoid regenerating on every render.
export function useMatrixPool(count: number, charsPerItem: number): string[] {
  const poolRef = useRef<string[] | undefined>(undefined);
  if (!poolRef.current) {
    poolRef.current = generateMatrixPool(count, charsPerItem);
  }
  return poolRef.current;
}

export type IMatrixBackgroundProps = {
  lineCount?: number;
  charsPerLine?: number;
  updateInterval?: number;
};
