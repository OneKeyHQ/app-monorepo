import type { ReactNode } from 'react';

import {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
  create,
} from 'react-test-renderer';

import { WalletBackupTestIDs } from '../../../components/WalletBackup/testIDs';

import BackupWalletReminder from './BackupWalletReminder';

import type { useRecoveryPhraseProtected } from '../../../hooks/useRecoveryPhraseProtected/useRecoveryPhraseProtected';

const mockEncodedMnemonic = 'encoded:test-only-recovery-phrase';
const mockWalletId = 'hd-test-only';
const mockPopStack = jest.fn();
const mockDecodeSensitiveText = jest.fn(
  async (_params: { encodedText: string }) =>
    ['mock-word-alpha', 'mock-word-beta'].join(' '),
);
const mockUpdateWalletBackupStatus = jest.fn(
  async (_params: { walletId: string; isBackedUp: boolean }) => undefined,
);
const mockUseRecoveryPhraseProtected: jest.MockedFunction<
  typeof useRecoveryPhraseProtected
> = jest.fn();
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      mnemonic: mockEncodedMnemonic,
      walletId: mockWalletId,
    },
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockView = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => React.createElement('View', props, children);
  return {
    __esModule: true,
    ANIMATE_ONLY_OPACITY_TRANSFORM: ['opacity', 'transform'],
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
    Button: MockView,
    Dialog: { show: jest.fn() },
    Icon: MockView,
    SizableText: MockView,
    Toast: { success: jest.fn() },
    XStack: MockView,
    YStack: MockView,
    useClipboard: () => ({ copyText: jest.fn() }),
    useMedia: () => ({ gtMd: false }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: mockPopStack }),
}));

jest.mock('@onekeyhq/shared/src/utils/sensitiveTextUtils', () => ({
  ensureSensitiveTextEncoded: jest.fn(),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      decodeSensitiveText: (params: { encodedText: string }) =>
        mockDecodeSensitiveText(params),
    },
    serviceAccount: {
      updateWalletBackupStatus: (params: {
        walletId: string;
        isBackedUp: boolean;
      }) => mockUpdateWalletBackupStatus(params),
    },
  },
}));

jest.mock(
  '../../../hooks/useRecoveryPhraseProtected/useRecoveryPhraseProtected',
  () => ({
    useRecoveryPhraseProtected: () => mockUseRecoveryPhraseProtected(),
  }),
);

jest.mock('../components/Layout', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockView = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => React.createElement('View', props, children);
  return {
    OnboardingHeading: MockView,
    OnboardingPage: MockView,
    OnboardingSidebar: MockView,
  };
});

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

interface ITestHostViewProps {
  testID: string;
  onPress?: () => void | Promise<void>;
}

type ITestHostView = ReactTestInstance & { props: ITestHostViewProps };

function isTestHostViewProps(
  props: unknown,
  testID: string,
): props is ITestHostViewProps {
  if (
    typeof props !== 'object' ||
    props === null ||
    !('testID' in props) ||
    props.testID !== testID
  ) {
    return false;
  }

  return !('onPress' in props) || typeof props.onPress === 'function';
}

function isTestHostView(
  node: ReactTestInstance,
  testID: string,
): node is ITestHostView {
  const nodeType: unknown = node.type;
  const props: unknown = node.props;
  return nodeType === 'View' && isTestHostViewProps(props, testID);
}

function findHostViewsByTestID(
  view: ReactTestRenderer,
  testID: string,
): ITestHostView[] {
  return view.root
    .findAll((node) => isTestHostView(node, testID))
    .filter((node): node is ITestHostView => isTestHostView(node, testID));
}

function getPressHandlerByTestID(
  view: ReactTestRenderer,
  testID: string,
): () => void | Promise<void> {
  const onPress = findHostViewsByTestID(view, testID)[0]?.props.onPress;
  expect(onPress).toEqual(expect.any(Function));
  return typeof onPress === 'function' ? onPress : () => undefined;
}

describe('BackupWalletReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('switches from the warning action to the protected confirmation action', async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<BackupWalletReminder />);
    });

    expect(
      findHostViewsByTestID(view, WalletBackupTestIDs.reminderPage),
    ).toHaveLength(1);
    expect(
      findHostViewsByTestID(view, WalletBackupTestIDs.showRecoveryPhrase),
    ).toHaveLength(1);
    expect(
      findHostViewsByTestID(view, WalletBackupTestIDs.confirmSavedPhrase),
    ).toHaveLength(0);
    expect(mockUseRecoveryPhraseProtected).not.toHaveBeenCalled();

    await act(async () => {
      await getPressHandlerByTestID(
        view,
        WalletBackupTestIDs.showRecoveryPhrase,
      )();
    });

    expect(mockDecodeSensitiveText).toHaveBeenCalledWith({
      encodedText: mockEncodedMnemonic,
    });
    expect(
      findHostViewsByTestID(view, WalletBackupTestIDs.showRecoveryPhrase),
    ).toHaveLength(0);
    expect(
      findHostViewsByTestID(view, WalletBackupTestIDs.confirmSavedPhrase),
    ).toHaveLength(1);
    expect(mockUseRecoveryPhraseProtected).toHaveBeenCalled();

    await act(async () => {
      await getPressHandlerByTestID(
        view,
        WalletBackupTestIDs.confirmSavedPhrase,
      )();
    });

    expect(mockUpdateWalletBackupStatus).toHaveBeenCalledWith({
      walletId: mockWalletId,
      isBackedUp: true,
    });
    expect(mockPopStack).toHaveBeenCalledTimes(1);
  });
});
