/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { HiddenWalletRememberSwitch } from './HiddenWalletRememberSwitch';

const mockSetWalletTempStatus = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    form_keep_hidden_wallet_label: 'form_keep_hidden_wallet_label',
    form_keep_hidden_wallet_label_desc: 'form_keep_hidden_wallet_label_desc',
    global_hidden_wallet: 'global_hidden_wallet',
  },
}));

jest.mock('@onekeyhq/kit/src//background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      setWalletTempStatus: async (...args: unknown[]): Promise<void> => {
        await mockSetWalletTempStatus(...args);
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ListItem: Object.assign(Wrapper, {
      Text: ({ primary }: { primary?: string }) => <span>{primary}</span>,
    }),
  };
});

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ESwitchSize: { small: 'small' },
    IconButton: () => null,
    Popover: () => null,
    SizableText: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    Switch: ({
      value,
      onChange,
      testID,
    }: {
      value?: boolean;
      onChange?: () => Promise<void> | void;
      testID?: string;
    }) => (
      <input
        type="checkbox"
        data-testid={testID}
        checked={!!value}
        // The component re-throws persist errors; swallow them like the real
        // Switch's event dispatch would, so the rejection does not leak.
        onChange={() => {
          Promise.resolve(onChange?.()).catch(() => {});
        }}
      />
    ),
  };
});

const hiddenWallet1 = { id: 'hw-1-hidden-a', isTemp: false } as IDBWallet;
const hiddenWallet2 = { id: 'hw-1-hidden-b', isTemp: false } as IDBWallet;

function getSwitch() {
  return screen.getByTestId('account-manager-switch') as HTMLInputElement;
}

describe('HiddenWalletRememberSwitch', () => {
  beforeEach(() => {
    mockSetWalletTempStatus.mockReset();
    mockSetWalletTempStatus.mockResolvedValue(undefined);
  });

  it('reflects each hidden wallet own state when the focused wallet changes', async () => {
    const { rerender } = render(
      <HiddenWalletRememberSwitch wallet={hiddenWallet2} />,
    );
    expect(getSwitch().checked).toBe(true);

    // Turn "keep accessible" off for hidden wallet 2.
    await act(async () => {
      fireEvent.click(getSwitch());
    });
    expect(mockSetWalletTempStatus).toHaveBeenCalledWith({
      walletId: hiddenWallet2.id,
      isTemp: true,
    });
    expect(getSwitch().checked).toBe(false);

    // The list refreshes wallet 2 with the persisted flag, then the user
    // focuses hidden wallet 1, which is still kept accessible (OK-63622).
    rerender(
      <HiddenWalletRememberSwitch
        wallet={{ ...hiddenWallet2, isTemp: true } as IDBWallet}
      />,
    );
    expect(getSwitch().checked).toBe(false);
    rerender(<HiddenWalletRememberSwitch wallet={hiddenWallet1} />);
    expect(getSwitch().checked).toBe(true);

    // Back to hidden wallet 2: it must show its own (off) state.
    rerender(
      <HiddenWalletRememberSwitch
        wallet={{ ...hiddenWallet2, isTemp: true } as IDBWallet}
      />,
    );
    expect(getSwitch().checked).toBe(false);
  });

  it('reverts the switch when persisting fails', async () => {
    mockSetWalletTempStatus.mockRejectedValueOnce(new Error('boom'));
    render(<HiddenWalletRememberSwitch wallet={hiddenWallet1} />);
    expect(getSwitch().checked).toBe(true);
    await act(async () => {
      fireEvent.click(getSwitch());
    });
    expect(getSwitch().checked).toBe(true);
  });
});
