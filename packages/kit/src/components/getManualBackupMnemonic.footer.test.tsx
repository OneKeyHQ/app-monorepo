/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-object-as-prop, react/jsx-no-constructed-context-values */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { DialogContext } from '../../../components/src/composite/Dialog/context';
import { Footer } from '../../../components/src/composite/Dialog/Footer';

import { getManualBackupMnemonic } from './WalletBackup/getManualBackupMnemonic';

import type {
  IDialogContextType,
  IDialogShowProps,
} from '../../../components/src/composite/Dialog/type';
import type { IntlShape } from 'react-intl';

let mockDialog: IDialogShowProps | undefined;
const mockForm = {
  trigger: jest.fn(async () => true),
  getValues: () => ({ password: 'typed-test-password' }),
  reset: jest.fn(),
};
const mockFormRef: { current: typeof mockForm | undefined } = {
  current: mockForm,
};
const mockClose = jest.fn(async () => {
  await mockDialog?.onClose?.();
});
const mockRecover = jest.fn(async () => ({ mnemonic: 'encoded-test-result' }));
const mockCancel = jest.fn(async () => undefined);
const intl = { formatMessage: () => 'Enter passcode' } as unknown as IntlShape;

jest.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { dialog: { dialogConfirm: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../../components/src/primitives', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress: () => Promise<void>;
    testID: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: Object.assign(
    {
      show: (props: IDialogShowProps) => {
        mockDialog = props;
        return { close: mockClose, getForm: () => mockFormRef.current };
      },
    },
    { Form: () => null, FormField: () => null },
  ),
  Input: () => null,
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => ({ key: 'manual-backup' }),
      addListener: () => jest.fn(),
    },
  },
}));
jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getManualMnemonicRecoveryInfo: async () => ({
        sessionId: 'footer-test-session',
        expiresAt: Date.now() + 5 * 60_000,
      }),
      getManualRecoveryMnemonic: () => mockRecover(),
      cancelManualMnemonicRecovery: () => mockCancel(),
    },
    servicePassword: {
      encodeSensitiveText: async () => 'encoded-test-password',
    },
  },
}));

async function flush() {
  await act(async () => {
    for (let i = 0; i < 15; i += 1) await Promise.resolve();
  });
}

async function openWithRealFooter() {
  const result = getManualBackupMnemonic('hd-1', intl);
  await flush();
  const context = {
    dialogInstance: {
      close: mockClose,
      ref: mockFormRef,
      isExist: () => true,
    },
    footerRef: {},
  } as unknown as IDialogContextType;
  render(
    <DialogContext.Provider value={context}>
      <Footer showFooter showConfirmButton onConfirm={mockDialog?.onConfirm} />
    </DialogContext.Provider>,
  );
  return { result };
}

async function pressConfirm() {
  fireEvent.click(screen.getByTestId('dialog-confirm-btn'));
  await flush();
}

describe('manual backup with the real Dialog Footer confirmation contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockForm.trigger.mockResolvedValue(true);
    mockFormRef.current = mockForm;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps an ordinarily invalid form open before the callback and allows retry', async () => {
    const { result } = await openWithRealFooter();
    mockForm.trigger.mockResolvedValue(false);
    await pressConfirm();
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockRecover).not.toHaveBeenCalled();
    mockForm.trigger.mockResolvedValue(true);
    await pressConfirm();
    await expect(result).resolves.toEqual({ mnemonic: 'encoded-test-result' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open when validation changes between Footer and callback', async () => {
    const { result } = await openWithRealFooter();
    mockForm.trigger.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await pressConfirm();
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockRecover).not.toHaveBeenCalled();
    await pressConfirm();
    await expect(result).resolves.toEqual({ mnemonic: 'encoded-test-result' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close while the lazy form is absent and can retry after registration', async () => {
    const { result } = await openWithRealFooter();
    mockFormRef.current = undefined;
    await pressConfirm();
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockRecover).not.toHaveBeenCalled();
    mockFormRef.current = mockForm;
    await pressConfirm();
    await expect(result).resolves.toEqual({ mnemonic: 'encoded-test-result' });
  });

  it('does not auto-close on a duplicate confirmation during password verification', async () => {
    let release!: (value: { mnemonic: string }) => void;
    mockRecover.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { result } = await openWithRealFooter();
    await pressConfirm();
    await pressConfirm();
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockRecover).toHaveBeenCalledTimes(1);
    release({ mnemonic: 'encoded-test-result' });
    await flush();
    await expect(result).resolves.toEqual({ mnemonic: 'encoded-test-result' });
  });
});
