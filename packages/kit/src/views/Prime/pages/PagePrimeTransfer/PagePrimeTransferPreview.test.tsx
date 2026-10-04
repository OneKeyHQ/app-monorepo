/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type ServicePrimeTransfer from '@onekeyhq/kit-bg/src/services/ServicePrimeTransfer/ServicePrimeTransfer';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPrimeTransferAccount,
  IPrimeTransferData,
  IPrimeTransferSelectedData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import PagePrimeTransferPreview from './PagePrimeTransferPreview';

const mockDialogs: IDialogShowProps[] = [];
const mockCloseDialog = jest.fn(async () => undefined);
const mockPromptPassword = jest.fn(async () => ({
  password: 'local-password',
}));
const mockVerify = jest.fn<
  ReturnType<ServicePrimeTransfer['verifyCredentialCanBeDecrypted']>,
  Parameters<ServicePrimeTransfer['verifyCredentialCanBeDecrypted']>
>();
const mockPrepareImport = jest.fn(async () => 'fixture-import-task');
const mockStartImport = jest.fn<
  ReturnType<ServicePrimeTransfer['startImport']>,
  [unknown]
>(async () => ({
  success: true,
  errorsInfo: [],
  taskUUID: 'fixture-import-task',
}));
const mockExit = jest.fn();
const mockToastError = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockNavigation = {};
let mockTransferData: IPrimeTransferData;
let mockSelectedData: IPrimeTransferSelectedData;
let mockConfirmImport: () => Promise<void>;

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: Container,
    Checkbox: () => null,
    Input: ({
      testID,
      onChangeText,
    }: {
      testID: string;
      onChangeText: (value: string) => void;
    }) => (
      <input
        data-testid={testID}
        onChange={(event) => onChangeText(event.target.value)}
      />
    ),
    Page: Object.assign(Container, {
      Header: () => null,
      Body: Container,
      Footer: ({ onConfirm }: { onConfirm: () => Promise<void> }) => {
        mockConfirmImport = onConfirm;
        return null;
      },
    }),
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Toast: {
      error: (params: unknown) => {
        mockToastError(params);
      },
    },
    Dialog: {
      show: (props: IDialogShowProps) => {
        mockDialogs.push(props);
        return { close: mockCloseDialog };
      },
    },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      promptPasswordVerify: () => mockPromptPassword(),
      encodeSensitiveText: async ({ text }: { text: string }) =>
        `encoded:${text}`,
    },
    servicePrimeTransfer: {
      verifyCredentialCanBeDecrypted: (
        ...args: Parameters<typeof mockVerify>
      ) => mockVerify(...args),
      prepareImportTask: () => mockPrepareImport(),
      initImportProgress: async () => undefined,
      startImport: (params: unknown) => mockStartImport(params),
      completeImportProgress: async () => undefined,
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Password/utils', () => ({
  getPasswordKeyboardType: () => 'default',
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: { transferData: mockTransferData } }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockSelectedData }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeTransferAtom: () => [{ shouldPreventExit: false }],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWebDappMode: false },
}));
jest.mock('./components/hooks/usePrimeTransferExit', () => ({
  usePrimeTransferExit: () => ({ exitTransferFlow: mockExit }),
}));
jest.mock('./components/PrimeTransferExitPrevent', () => ({
  PrimeTransferExitPrevent: () => null,
}));
jest.mock('./components/PrimeTransferImportProcessingDialog', () => ({
  registerPrimeTransferImportTraceDebugGlobal: () => undefined,
  showPrimeTransferImportProcessingDialog: () => ({ close: jest.fn() }),
}));

function accountFixture(id: string): IPrimeTransferAccount {
  return {
    id,
    version: 1,
    name: 'Fixture account',
    address: 'fixture-address',
    type: undefined,
    template: undefined,
    path: undefined,
    createAtNetwork: undefined,
    networks: undefined,
    impl: undefined,
    coinType: undefined,
    accountOrder: undefined,
    accountOrderSaved: undefined,
    pub: undefined,
    xpub: undefined,
    xpubSegwit: undefined,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockDialogs.length = 0;
  mockPromptPassword.mockResolvedValue({ password: 'local-password' });
  // Model the password boundary; the service suite exercises actual preflight.
  mockVerify.mockImplementation(async ({ password, decryptedCredentialsHex }) =>
    decryptedCredentialsHex ? password === 'source-password' : true,
  );
  const item = accountFixture('imported-fixture');
  mockSelectedData = {
    wallets: [],
    importedAccounts: [{ id: item.id, item }],
    watchingAccounts: [],
  };
  mockTransferData = {
    appVersion: 'fixture',
    publicData: undefined,
    isWatchingOnly: false,
    isEmptyData: false,
    privateData: {
      wallets: {},
      importedAccounts: { [item.id]: item },
      watchingAccounts: {},
      credentials: {},
      decryptedCredentialsHex: 'fixture-wrapped-credentials',
    },
  };
});

afterEach(() => {
  jest.useRealTimers();
});

test('wrapped credentials require the source password before reserving or starting import', async () => {
  render(<PagePrimeTransferPreview />);
  await act(async () => mockConfirmImport());
  expect(mockPromptPassword).toHaveBeenCalledTimes(1);
  expect(mockVerify).toHaveBeenLastCalledWith({
    password: 'local-password',
    decryptedCredentialsHex: 'fixture-wrapped-credentials',
    walletCredential: undefined,
    importedAccountCredential: undefined,
  });
  expect(mockPrepareImport).not.toHaveBeenCalled();
  expect(mockStartImport).not.toHaveBeenCalled();
  expect(mockDialogs).toHaveLength(1);

  const dialog = mockDialogs[0];
  expect(dialog.title).toBe(ETranslations.transfer_verify_passcode);
  const view = render(<>{dialog.renderContent}</>);
  const input = view.getByTestId('remote-device-password-input');
  const preventClose = jest.fn();
  const dialogInstance = {
    preventClose,
    close: mockCloseDialog,
    getForm: () => undefined,
    isExist: () => true,
  };
  fireEvent.change(input, { target: { value: 'incorrect-source-password' } });
  await act(async () => {
    await dialog.onConfirm?.(dialogInstance);
  });
  expect(preventClose).toHaveBeenCalled();
  expect(mockVerify).toHaveBeenLastCalledWith(
    expect.objectContaining({
      password: 'incorrect-source-password',
      decryptedCredentialsHex: 'fixture-wrapped-credentials',
    }),
  );
  expect(mockToastError).toHaveBeenCalledWith({
    title: ETranslations.auth_error_passcode_incorrect,
  });
  expect(mockPrepareImport).not.toHaveBeenCalled();
  expect(mockStartImport).not.toHaveBeenCalled();
  expect(mockCloseDialog).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(300));
  fireEvent.change(input, { target: { value: 'source-password' } });
  await act(async () => {
    await dialog.onConfirm?.(dialogInstance);
  });
  expect(mockPromptPassword).toHaveBeenCalledTimes(1);
  expect(mockPrepareImport).toHaveBeenCalledTimes(1);
  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  expect(mockStartImport).toHaveBeenCalledWith(
    expect.objectContaining({
      decryptedCredentialsHex: 'fixture-wrapped-credentials',
      password: 'encoded:source-password',
      localPassword: 'encoded:local-password',
    }),
  );
  expect(mockExit).toHaveBeenCalledTimes(1);
});

test('matching source and local passwords import without a remote-password dialog', async () => {
  mockPromptPassword.mockResolvedValue({ password: 'source-password' });
  render(<PagePrimeTransferPreview />);
  await act(async () => mockConfirmImport());
  expect(mockDialogs).toHaveLength(0);
  expect(mockVerify).toHaveBeenCalledWith(
    expect.objectContaining({
      password: 'source-password',
      decryptedCredentialsHex: 'fixture-wrapped-credentials',
    }),
  );
  expect(mockStartImport).toHaveBeenCalledWith(
    expect.objectContaining({
      password: 'encoded:source-password',
      localPassword: 'encoded:source-password',
    }),
  );
});

test('watching-only selection ignores unselected wrapped credentials and requires no password', async () => {
  const item = accountFixture('watching-fixture');
  mockTransferData.privateData.watchingAccounts[item.id] = item;
  mockSelectedData = {
    wallets: [],
    importedAccounts: [],
    watchingAccounts: [{ id: item.id, item }],
  };
  render(<PagePrimeTransferPreview />);
  await act(async () => mockConfirmImport());
  expect(mockPromptPassword).not.toHaveBeenCalled();
  expect(mockDialogs).toHaveLength(0);
  expect(mockVerify).toHaveBeenCalledWith({
    password: '',
    decryptedCredentialsHex: undefined,
    walletCredential: undefined,
    importedAccountCredential: undefined,
  });
  expect(mockStartImport).toHaveBeenCalledWith(
    expect.objectContaining({
      password: '',
      localPassword: '',
      decryptedCredentialsHex: undefined,
    }),
  );
});
