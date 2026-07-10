import fs from 'fs';
import path from 'path';

const formFiles = ['PerpTradingForm.tsx', 'LimitOrderForm.tsx'];

describe('Perps trading available balance label', () => {
  it.each(formFiles)('uses the localized full label in %s', (fileName) => {
    const source = fs.readFileSync(path.join(__dirname, fileName), 'utf8');

    expect(source).toContain(
      'ETranslations.perp_trade_account_overview_available',
    );
    expect(source).not.toContain(
      'ETranslations.perp_trade_account_overview_avbl',
    );
  });
});
