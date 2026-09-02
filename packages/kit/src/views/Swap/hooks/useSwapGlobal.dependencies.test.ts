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

  it('applies token side effects only after the account revision is accepted', () => {
    const syncStart = source.indexOf(
      'const syncSwapSelectedAccountFromHome = useCallback',
    );
    const syncEnd = source.indexOf(
      'const syncSwapSelectedAccountFromLatestHome',
      syncStart,
    );
    const syncSource = source.slice(syncStart, syncEnd);
    const selectionCommit = syncSource.indexOf(
      'const selectionResult = await updateSelectedAccount',
    );
    const outcomeGate = syncSource.indexOf(
      'if (!isSwapAccountSelectionSyncAccepted(selectionResult.outcome))',
    );
    const tokenMutation = syncSource.indexOf(
      "if (selectedTokensSyncAction.type === 'replace-with-defaults')",
    );

    expect(syncStart).toBeGreaterThan(0);
    expect(syncEnd).toBeGreaterThan(syncStart);
    expect(selectionCommit).toBeGreaterThan(0);
    expect(outcomeGate).toBeGreaterThan(selectionCommit);
    expect(tokenMutation).toBeGreaterThan(outcomeGate);
  });
});
