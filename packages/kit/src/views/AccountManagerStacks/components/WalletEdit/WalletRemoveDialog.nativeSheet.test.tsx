import { showWalletRemoveDialog } from './WalletRemoveDialog';

const dialogShowMock = jest.fn();
let mockIsNativeAndroid = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Checkbox: () => null,
  Dialog: {
    show: (...args: unknown[]) => {
      dialogShowMock(...args);
      return { close: jest.fn() };
    },
    Footer: () => null,
  },
  Toast: { success: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: jest.fn(),
  }),
);

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));

const showDialog = () =>
  showWalletRemoveDialog({
    nativeSheet: true,
    title: 'Remove wallet',
    description: 'Make sure you have written down the recovery phrase',
    defaultChecked: false,
    showCheckBox: true,
    config: undefined,
  });

describe('showWalletRemoveDialog native sheet presentation', () => {
  beforeEach(() => {
    dialogShowMock.mockReset();
  });

  it('keeps the Tamagui sheet on Android so the passcode prompt stays on top', () => {
    mockIsNativeAndroid = true;

    showDialog();

    expect(dialogShowMock).toHaveBeenCalledWith(
      expect.objectContaining({ nativeSheet: false }),
    );
  });

  it('keeps the requested native sheet on other platforms', () => {
    mockIsNativeAndroid = false;

    showDialog();

    expect(dialogShowMock).toHaveBeenCalledWith(
      expect.objectContaining({ nativeSheet: true }),
    );
  });
});
