/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { useEarnDesktopHomeCopy } from './earnDesktopHomeCopy';

function Copy() {
  const copy = useEarnDesktopHomeCopy();
  return (
    <>
      <span data-testid="stage">{copy.guideTitle}</span>
      <span data-testid="borrowed">{copy.loanDone('100 USDC', 'Aave')}</span>
    </>
  );
}

it('updates the guide and an interpolated loan receipt when the locale changes', async () => {
  const [enUS, frFR, zhCN] = await Promise.all([
    loadLocaleMessages('en-US'),
    loadLocaleMessages('fr-FR'),
    loadLocaleMessages('zh-CN'),
  ]);
  const { rerender } = render(
    <IntlProvider locale="en-US" messages={enUS}>
      <Copy />
    </IntlProvider>,
  );
  expect(screen.getByTestId('stage').textContent).toBe(
    'Start earning in 4 steps',
  );
  expect(screen.getByTestId('borrowed').textContent).toContain(
    '100 USDC borrowed on Aave',
  );

  rerender(
    <IntlProvider locale="zh-CN" messages={zhCN}>
      <Copy />
    </IntlProvider>,
  );
  expect(screen.getByTestId('stage').textContent).toBe('4 步开始赚币');
  expect(screen.getByTestId('borrowed').textContent).toContain(
    '已在 Aave 借入 100 USDC',
  );

  rerender(
    <IntlProvider locale="fr-FR" messages={frFR}>
      <Copy />
    </IntlProvider>,
  );
  expect(screen.getByTestId('stage').textContent).toBe(
    frFR.earn_guide_title__title,
  );
  expect(screen.getByTestId('borrowed').textContent).toContain('100 USDC');
  expect(screen.getByTestId('borrowed').textContent).toContain('Aave');
});
