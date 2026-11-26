/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { SwapXmrPrivacyNotice } from './SwapXmrPrivacyNotice';

const mockRun = jest.fn();
let mockCanSend = true;
let mockConfirming = true;

jest.mock('@onekeyhq/components', () => ({
  Alert: ({ testID, description }: { testID: string; description: string }) => (
    <div data-testid={testID}>{description}</div>
  ),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    run: mockRun,
    result: {
      scope: 'xmr--0:fixture-account:true',
      state: { enabled: true },
      readiness: { canSend: mockCanSend, blocksLeft: mockCanSend ? 0 : 110 },
      balance: {
        spendable: '300000000000',
        frozen: [
          { reason: 'needsPassword', amountParsed: '0.5' },
          ...(mockConfirming
            ? [{ reason: 'confirming', amountParsed: '0.4' }]
            : []),
        ],
      },
    },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletPasswordAlert',
  () => ({
    LocalWalletPasswordAlert: ({ onVerified }: { onVerified: () => void }) => (
      <button type="button" onClick={onVerified}>
        Verify password
      </button>
    ),
  }),
);

function renderNotice(onBalanceVerified = jest.fn()) {
  render(
    <IntlProvider locale="en">
      <SwapXmrPrivacyNotice
        accountId="fixture-account"
        networkId="xmr--0"
        fromAmount="0.6"
        onBalanceVerified={onBalanceVerified}
      />
    </IntlProvider>,
  );
  return onBalanceVerified;
}

beforeEach(() => {
  mockRun.mockClear();
});

it.each([true, false])(
  'keeps password verification available for spendable wallets (confirming: %s)',
  (confirming) => {
    mockCanSend = true;
    mockConfirming = confirming;
    const onBalanceVerified = renderNotice();
    expect(!!screen.queryByTestId('swap-xmr-privacy-notice')).toBe(confirming);
    fireEvent.click(screen.getByRole('button', { name: 'Verify password' }));
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(onBalanceVerified).toHaveBeenCalledTimes(1);
  },
);

it('shows the sync requirement while the wallet cannot send', () => {
  mockCanSend = false;
  mockConfirming = true;
  renderNotice();
  expect(screen.getByTestId('swap-xmr-privacy-notice')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Verify password' })).toBeNull();
});
