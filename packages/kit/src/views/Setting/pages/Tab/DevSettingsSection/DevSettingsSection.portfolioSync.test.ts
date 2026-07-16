import fs from 'fs';
import path from 'path';

describe('DevSettingsSection portfolio sync setting', () => {
  test('exposes the persisted portfolio sync switch in developer mode', () => {
    const source = fs.readFileSync(path.join(__dirname, 'index.tsx'), 'utf8');

    expect(source).toContain('name="enablePortfolioSyncDev"');
    expect(source).toContain('testID="enable-portfolio-sync"');
  });
});
