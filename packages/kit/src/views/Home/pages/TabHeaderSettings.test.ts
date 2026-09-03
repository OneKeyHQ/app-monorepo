import { readFileSync } from 'fs';
import { join } from 'path';

describe('Home token-list settings', () => {
  it('keeps DeFi tokens and token management in one responsive settings menu', () => {
    const source = readFileSync(
      join(__dirname, 'TabHeaderSettings.tsx'),
      'utf8',
    );
    const tokenListSource = readFileSync(
      join(__dirname, '../components/TokenListBlock/TokenListBlock.tsx'),
      'utf8',
    );

    expect(source).toContain('function TokenListSettingsContent({');
    expect(source).toContain('ETranslations.wallet_defi_tokens__action');
    expect(source).toContain('ETranslations.manage_token_title');
    expect(source).toContain('useTokenSelectorFilterPersistAtom');
    expect(source).toContain('testID="home-defi-token-switch"');
    expect(source).toContain('testID="home-manage-token"');
    expect(source).toContain('icon="SliderHorOutline"');
    expect(source).not.toContain('useMedia');
    expect(tokenListSource).not.toContain('<TokenSelectorLpTokenSwitch');
    expect(tokenListSource).not.toContain(
      'testID="home-render-header-actions-icon-btn"',
    );
  });
});
