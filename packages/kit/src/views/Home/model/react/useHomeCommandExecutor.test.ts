import fs from 'fs';
import path from 'path';

function readSource(fileName: string) {
  return fs.readFileSync(path.join(__dirname, fileName), 'utf8');
}

describe('Home command executor parity', () => {
  it('opens the account selector with the legacy Home capabilities', () => {
    const source = readSource('useHomeCommandExecutor.ts');
    const accountSelectorConfig =
      source.match(/useAccountSelectorTrigger\(\{([\s\S]*?)\}\);/)?.[1] ?? '';

    expect(accountSelectorConfig).toContain('editable: true');
    expect(accountSelectorConfig).toContain('keepAllOtherAccounts: true');
    expect(accountSelectorConfig).toContain('allowSelectEmptyAccount: true');
    expect(accountSelectorConfig).toContain(
      'hideAddress: vaultSettings?.mergeDeriveAssetsEnabled',
    );
    expect(accountSelectorConfig).toContain(
      'linkNetwork: !network?.isAllNetworks',
    );
  });

  it('keeps the legacy Home network selector behavior', () => {
    const source = readSource('useHomeCommandExecutor.ts');

    expect(source).toContain('recordNetworkHistoryEnabled: true');
    expect(source).toContain(
      "defaultTab: network?.isAllNetworks ? 'portfolio' : undefined",
    );
  });
});
