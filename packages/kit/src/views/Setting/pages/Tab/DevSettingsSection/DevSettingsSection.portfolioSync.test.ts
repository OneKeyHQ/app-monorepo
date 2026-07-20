import fs from 'fs';
import path from 'path';

describe('DevSettingsSection portfolio sync setting', () => {
  test('exposes independent Pro 2 module switches in developer mode', () => {
    const sectionSource = fs.readFileSync(
      path.join(__dirname, 'Pro2DebugDevSettings.tsx'),
      'utf8',
    );
    const indexSource = fs.readFileSync(
      path.join(__dirname, 'index.tsx'),
      'utf8',
    );

    expect(indexSource).toContain('<Pro2DebugDevSettings />');
    expect(sectionSource).toContain('name="enablePro2OnboardingDev"');
    expect(sectionSource).toContain('testID="enable-pro2-onboarding"');
    expect(sectionSource).toContain('name="enablePortfolioSyncDev"');
    expect(sectionSource).toContain('testID="enable-portfolio-sync"');
  });
});
