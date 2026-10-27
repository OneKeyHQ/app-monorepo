/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LocalWalletFrozenLines } from './LocalWalletFrozenLines';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      Object.entries(values ?? {}).reduce(
        (text, [key, value]) => text.replace(`{${key}}`, value),
        id === ETranslations.privacy_balance_small_change__msg
          ? 'Includes {amount} of small change that’s too small to send on its own.'
          : id,
      ),
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div data-testid="line">{children}</div>
  );
  return {
    Button: () => null,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    XStack: Wrapper,
    YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

describe('LocalWalletFrozenLines small change', () => {
  it('explains dust change with its amount, after the other reasons', () => {
    render(
      <LocalWalletFrozenLines
        networkId="zec--0"
        accountId="hd-1--0"
        symbol="ZEC"
        frozen={[
          { reason: 'smallChange', amountParsed: '0.00005' },
          { reason: 'confirming', amountParsed: '0.1' },
        ]}
      />,
    );

    const lines = screen.getAllByTestId('line').map((el) => el.textContent);
    expect(lines).toEqual([
      'global.confirming 0.1 ZEC',
      'Includes 0.00005 ZEC of small change that’s too small to send on its own.',
    ]);
  });

  it('shows nothing when there is no small change', () => {
    const { container } = render(
      <LocalWalletFrozenLines
        networkId="zec--0"
        accountId="hd-1--0"
        frozen={[]}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('LocalWalletFrozenLines confirming', () => {
  it('says how many blocks and about how long until confirming funds are spendable', () => {
    render(
      <LocalWalletFrozenLines
        networkId="xmr--0"
        accountId="hd-1--0"
        symbol="XMR"
        frozen={[
          {
            reason: 'confirming',
            amountParsed: '0.03',
            confirmInBlocks: 7,
            confirmInSeconds: 840,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('line').textContent).toBe(
      `global.confirming 0.03 XMR · ${ETranslations.tx_confirm_eta_blocks__desc} · ${ETranslations.tx_confirm_eta_minutes__desc}`,
    );
  });
});
