import fs from 'fs';
import path from 'path';

// Web builds resolve `index.web-only.tsx` before `index.tsx`, and a missing
// re-export is `undefined` at runtime instead of a build error.
const NATIVE_ONLY_EXPORTS = new Set(['./useForm']);

function readReExports(fileName: string) {
  const source = fs.readFileSync(path.join(__dirname, fileName), 'utf8');
  return [...source.matchAll(/export \* from '([^']+)';/g)].map(
    ([, specifier]) => specifier,
  );
}

describe('hook barrels', () => {
  it('re-exports the same hooks on web as on native', () => {
    const native = readReExports('index.tsx').filter(
      (specifier) => !NATIVE_ONLY_EXPORTS.has(specifier),
    );
    expect(readReExports('index.web-only.tsx').toSorted()).toEqual(
      native.toSorted(),
    );
  });
});
