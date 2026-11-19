/** @jest-environment jsdom */

import type { ReactNode, RefObject } from 'react';
import { useEffect, useImperativeHandle } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { ITextAreaInputProps } from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2ImportPhraseOrPrivateKeyTab,
} from '@onekeyhq/shared/src/routes';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';

import { OnboardingTestIDs } from '../testIDs';

import ImportPhraseOrPrivateKey from './ImportPhraseOrPrivateKey';

import type { IPhaseInputAreaInstance } from '../components/PhaseInputArea';

const mockPush = jest.fn();
const mockEncode = jest.fn(async () => 'encoded-test-key');
const networkResult = { detectedNetworks: [{ networkId: 'evm--1' }] };
const mockDetectNetworks = jest.fn(async () => networkResult);
const mockSubmitPhrase = jest.fn(async () => ({
  mnemonic: 'encoded-test-phrase',
  mnemonicType: EMnemonicType.BIP39,
}));
const mockShowError = jest.fn();
let mockIsFocused = true;

jest.mock('@react-navigation/core', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const focused = mockIsFocused;
    useEffect(() => (focused ? effect() : undefined), [effect, focused]);
  },
  useRoute: () => ({}),
}));
jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native'),
);
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const { TextInput } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: ({
      testID,
      onPress,
      children,
    }: {
      testID: string;
      onPress: () => void;
      children?: ReactNode;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    HeightTransition: Wrapper,
    Icon: () => null,
    SegmentControl: ({
      options,
      onChange,
    }: {
      options: { value: string; label: string; testID: string }[];
      onChange: (value: string) => void;
    }) =>
      options.map(({ value, label, testID }) => (
        <button
          type="button"
          key={value}
          data-testid={testID}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      )),
    SizableText: Wrapper,
    TextAreaInput: ({
      blurOnSubmit,
      onChangeText,
      onSubmitEditing,
      testID,
      value,
    }: ITextAreaInputProps) => (
      <TextInput
        accessible
        multiline
        blurOnSubmit={blurOnSubmit}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        testID={testID}
        value={value}
      />
    ),
    XStack: Wrapper,
    YStack: Wrapper,
    useMedia: () => ({ gtMd: true }),
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: jest.fn(),
    showToastOfError: (error: unknown) => {
      mockShowError(error);
    },
  },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: { encodeSensitiveText: () => mockEncode() },
    serviceNetwork: { detectNetworksByPrivateKey: () => mockDetectNetworks() },
  },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
}));
jest.mock('../../../hooks/useRecoveryPhraseProtected', () => ({
  __esModule: true,
  default: () => {},
}));
jest.mock('../../ScanQrCode/hooks/useScanQrCodeLazy', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../components/Layout', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    OnboardingHeading: Wrapper,
    OnboardingPage: Wrapper,
    OnboardingSidebar: Wrapper,
    OnboardingIconBadge: () => null,
  };
});
jest.mock('../components/PhaseInputArea', () => ({
  PhaseInputArea: ({ ref }: { ref: RefObject<IPhaseInputAreaInstance> }) => {
    useImperativeHandle(ref, () => ({
      submit: mockSubmitPhrase,
    }));
    return (
      <input
        aria-label="Recovery word"
        data-testid={OnboardingTestIDs.phraseInput(0)}
      />
    );
  },
}));

function selectPrivateKeyTab() {
  fireEvent.click(screen.getByTestId(OnboardingTestIDs.importPrivateKeyTab));
  const input = screen.getByTestId<HTMLTextAreaElement>(
    OnboardingTestIDs.importPrivateKeyInput,
  );
  input.focus();
  return input;
}

function enter(input: HTMLElement) {
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('Import Wallet keyboard submission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused = true;
  });

  it('submits the focused private-key tab once on Enter and leaves phrase input separate', async () => {
    render(<ImportPhraseOrPrivateKey />);
    const phraseInput = screen.getByTestId(OnboardingTestIDs.phraseInput(0));
    phraseInput.focus();
    enter(phraseInput);
    expect(mockDetectNetworks).not.toHaveBeenCalled();

    const input = selectPrivateKeyTab();
    expect(document.activeElement).toBe(input);
    expect(screen.queryByTestId(OnboardingTestIDs.phraseInput(0))).toBeNull();
    fireEvent.change(input, { target: { value: 'dummy-private-key' } });
    expect(input.value).toBe('•'.repeat('dummy-private-key'.length));
    const detection = Promise.withResolvers<typeof networkResult>();
    mockDetectNetworks.mockReturnValueOnce(detection.promise);

    await act(async () => {
      enter(input);
      fireEvent.click(
        screen.getByTestId(OnboardingTestIDs.importPhraseConfirmBtn),
      );
    });
    expect(mockEncode).toHaveBeenCalledTimes(1);
    expect(mockDetectNetworks).toHaveBeenCalledTimes(1);
    expect(mockSubmitPhrase).not.toHaveBeenCalled();

    await act(async () => detection.resolve(networkResult));
    expect(mockPush).toHaveBeenCalledWith(
      EOnboardingPagesV2.SelectPrivateKeyNetwork,
      {
        input: 'encoded-test-key',
        detectedNetworks: networkResult.detectedNetworks,
        importType: EOnboardingV2ImportPhraseOrPrivateKeyTab.PrivateKey,
      },
    );
    expect(input.value).toBe('');
    input.focus();
    await act(async () => enter(input));
    expect(mockEncode).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it.each(['blur', 'unmount'])(
    'discards pending network detection on screen %s',
    async (leaveScreen) => {
      const { rerender, unmount } = render(<ImportPhraseOrPrivateKey />);
      const input = selectPrivateKeyTab();
      fireEvent.change(input, { target: { value: 'dummy-private-key' } });
      const detection = Promise.withResolvers<typeof networkResult>();
      mockDetectNetworks.mockReturnValueOnce(detection.promise);
      await act(async () => enter(input));
      expect(mockDetectNetworks).toHaveBeenCalledTimes(1);

      if (leaveScreen === 'unmount') {
        unmount();
      } else {
        mockIsFocused = false;
        rerender(<ImportPhraseOrPrivateKey />);
        await act(async () => enter(input));
        expect(mockDetectNetworks).toHaveBeenCalledTimes(1);
        mockIsFocused = true;
        rerender(<ImportPhraseOrPrivateKey />);
      }

      await act(async () => detection.resolve(networkResult));
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();

      if (leaveScreen === 'blur') {
        await act(async () => enter(input));
        expect(mockDetectNetworks).toHaveBeenCalledTimes(2);
        expect(mockPush).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('lets a replacement key submit while the previous detection is pending', async () => {
    render(<ImportPhraseOrPrivateKey />);
    const input = selectPrivateKeyTab();
    const original = Promise.withResolvers<typeof networkResult>();
    const replacement = Promise.withResolvers<typeof networkResult>();
    mockEncode
      .mockResolvedValueOnce('encoded-original-key')
      .mockResolvedValueOnce('encoded-replacement-key');
    mockDetectNetworks
      .mockReturnValueOnce(original.promise)
      .mockReturnValueOnce(replacement.promise);

    fireEvent.change(input, { target: { value: 'dummy-original-key' } });
    await act(async () => enter(input));
    expect(mockDetectNetworks).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: ' dummy-original-key ' } });
    await act(async () => enter(input));
    expect(mockDetectNetworks).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: 'dummy-replacement-key' } });
    await act(async () => enter(input));
    expect(mockDetectNetworks).toHaveBeenCalledTimes(2);

    await act(async () => original.resolve(networkResult));
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => enter(input));
    expect(mockDetectNetworks).toHaveBeenCalledTimes(2);

    await act(async () => replacement.resolve(networkResult));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      EOnboardingPagesV2.SelectPrivateKeyNetwork,
      {
        input: 'encoded-replacement-key',
        detectedNetworks: networkResult.detectedNetworks,
        importType: EOnboardingV2ImportPhraseOrPrivateKeyTab.PrivateKey,
      },
    );
  });

  it('ignores a private-key result after switching back to the Recovery Phrase tab', async () => {
    render(<ImportPhraseOrPrivateKey />);
    const input = selectPrivateKeyTab();
    fireEvent.change(input, { target: { value: 'dummy-private-key' } });
    const detection = Promise.withResolvers<typeof networkResult>();
    mockDetectNetworks.mockReturnValueOnce(detection.promise);
    await act(async () => enter(input));
    expect(mockDetectNetworks).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId(OnboardingTestIDs.importPhraseTab));
    expect(
      screen.queryByTestId(OnboardingTestIDs.importPrivateKeyInput),
    ).toBeNull();
    await act(async () => detection.resolve(networkResult));
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(OnboardingTestIDs.importPhraseConfirmBtn),
      );
    });
    expect(mockSubmitPhrase).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      EOnboardingPagesV2.FinalizeWalletSetup,
      {
        mnemonic: 'encoded-test-phrase',
        mnemonicType: EMnemonicType.BIP39,
        isWalletBackedUp: true,
      },
    );
    expect(mockDetectNetworks).toHaveBeenCalledTimes(1);
  });

  it('blocks an empty key and stays on the private-key tab after a validation error', async () => {
    render(<ImportPhraseOrPrivateKey />);
    const input = selectPrivateKeyTab();
    await act(async () => enter(input));
    expect(mockEncode).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'dummy-invalid-key' } });
    mockDetectNetworks.mockRejectedValueOnce({ message: 'Validation failed' });
    await act(async () => enter(input));
    expect(mockShowError).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'dummy-private-key' } });
    await act(async () => enter(input));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
