import { readFileSync } from 'fs';
import { join } from 'path';

describe('useSwapGlobal default token sync dependencies', () => {
  const source = readFileSync(join(__dirname, 'useSwapGlobal.ts'), 'utf8');

  it('re-runs default token sync only when Native Pro ownership changes', () => {
    const effectStart = source.indexOf('await syncDefaultSelectedToken();');
    const effectEnd = source.indexOf(']);', effectStart);
    const effectSource = source.slice(effectStart, effectEnd);

    expect(effectStart).toBeGreaterThan(0);
    expect(effectEnd).toBeGreaterThan(effectStart);
    expect(effectSource).toContain('isNativeProTokenOwner');
    expect(effectSource).not.toMatch(/\n\s+swapTypeSwitch,\n/u);
  });
});
