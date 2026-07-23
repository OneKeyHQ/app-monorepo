import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeTestIDs } from '../../testIDs';

import { NativeHomeZeroBalanceWalletActions } from './ZeroBalanceWalletActions';

const mockHandleOnReceive = jest.fn();
const mockMorePress = jest.fn();
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Host = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => React.createElement('View', props, children);

  return {
    Button: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('Button', props, children),
    SizableText: Host,
    XStack: Host,
    YStack: Host,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      checkIsWalletNotBackedUp: jest.fn(async () => false),
    },
    serviceTokenViewModel: {
      getAllTokenListMap: jest.fn(async () => ({})),
      getRawTokenList: jest.fn(async () => ({
        accountId: 'account-1',
        keys: '',
        networkId: 'onekeyall--0',
        tokens: [],
      })),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus', () => ({
  useBotWalletDeactivatedStatus: () => ({
    isBotWallet: false,
    isBotWalletDeactivated: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useReceiveToken', () => ({
  useReceiveToken: () => ({ handleOnReceive: mockHandleOnReceive }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useUserWalletProfile', () => ({
  useUserWalletProfile: () => ({ isSoftwareWalletOnlyUser: false }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _callback: () => Promise<unknown>,
    _deps: unknown[],
    options?: { initResult?: unknown },
  ) => ({ result: options?.initResult }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'account-1' },
      deriveInfoItems: [],
      indexedAccount: undefined,
      network: { id: 'onekeyall--0', isAllNetworks: true },
      wallet: { id: 'wallet-1', type: 'hd' },
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/utils/botWalletDisabledToast', () => ({
  showBotWalletDisabledToast: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/utils/botWalletStatusUtils', () => ({
  shouldBlockBotWalletReceive: () => false,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    wallet: {
      walletActions: { actionReceive: jest.fn() },
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker',
  () => ({ JotaiContextStoreMirrorTracker: () => null }),
);

jest.mock('./RawActions', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    RawActions: ({ children }: { children?: ReactNode }) =>
      React.createElement('View', null, children),
  };
});

jest.mock('./WalletActionMore', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    WalletActionMore: () =>
      React.createElement('Button', {
        onPress: mockMorePress,
        testID: HomeTestIDs.moreButton,
      }),
  };
});

describe('NativeHomeZeroBalanceWalletActions', () => {
  beforeAll(() => {
    mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mounts without a Legacy producer and keeps Add money and More clickable', async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <NativeHomeZeroBalanceWalletActions accountId="account-1" />,
      );
    });

    const onAddMoneyPress = view.root.findByProps({
      testID: HomeTestIDs.addMoneyButton,
    }).props.onPress as () => Promise<void>;
    const onMorePress = view.root.findByProps({
      testID: HomeTestIDs.moreButton,
    }).props.onPress as () => void;
    await act(async () => {
      await onAddMoneyPress();
    });
    act(() => {
      onMorePress();
    });

    expect(mockHandleOnReceive).toHaveBeenCalledWith({
      sameModal: undefined,
      useSelector: true,
      withAllAggregateTokens: true,
    });
    expect(mockMorePress).toHaveBeenCalledTimes(1);
  });
});
