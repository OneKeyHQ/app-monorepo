/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { createIntl } from 'react-intl';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';

import { showStarknetPrivacyConsentDialog } from './showStarknetPrivacyConsentDialog';

type IMockDialogOptions = { renderContent: ReactNode; onClose: () => void };
type IMockProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

let mockDialogOptions: IMockDialogOptions | undefined;
const mockClose = jest.fn(async () => mockDialogOptions?.onClose());
const mockShow = jest.fn((options: IMockDialogOptions) => {
  mockDialogOptions = options;
  return { close: mockClose };
});
const mockCopy = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const View = ({ children, testID }: IMockProps) => (
    <div data-testid={testID}>{children}</div>
  );
  const Text = ({ children, testID }: IMockProps) => (
    <span data-testid={testID}>{children}</span>
  );
  const Button = ({
    children,
    testID,
    onPress,
    disabled,
    accessibilityLabel,
  }: IMockProps) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
      aria-label={accessibilityLabel}
    >
      {children}
    </button>
  );
  return {
    YStack: View,
    XStack: View,
    SizableText: Text,
    Button,
    IconButton: Button,
    useClipboard: () => ({ copyText: mockCopy }),
    Checkbox: ({
      testID,
      label,
      value,
      onChange,
    }: {
      testID: string;
      label: string;
      value: boolean | 'indeterminate';
      onChange: (value: boolean) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          data-testid={testID}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
    ),
    Dialog: {
      show: (options: IMockDialogOptions) => mockShow(options),
      Footer: ({
        onConfirm,
        onConfirmText,
        confirmButtonProps,
      }: {
        onConfirm: () => Promise<void>;
        onConfirmText: string;
        confirmButtonProps: { disabled: boolean; testID: string };
      }) => (
        <button
          type="button"
          data-testid={confirmButtonProps.testID}
          disabled={confirmButtonProps.disabled}
          onClick={() => void onConfirm()}
        >
          {onConfirmText}
        </button>
      ),
    },
  };
});

const intl = createIntl({
  locale: 'en',
  onError: () => undefined,
});
const auditorPublicKey = `0x${'1234abcd'.repeat(8)}`;
const config: IStrk20PrivacyNetworkConfig = {
  networkId: 'starknet--mainnet',
  poolAddress: '0x123',
  discoveryUrl: 'https://discovery.example',
  provingUrl: 'https://prover.example',
  minRpcSpecVersion: '0.10.0',
  auditorPublicKey,
};

function show(protocolFee?: string) {
  const result = showStarknetPrivacyConsentDialog({
    intl,
    config,
    protocolFee,
  });
  if (!mockDialogOptions)
    throw new OneKeyLocalError('Consent content was not mounted');
  return { ...render(mockDialogOptions.renderContent), result };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDialogOptions = undefined;
});

it('keeps privacy limits and permanent registration visible before expanding details', () => {
  const ui = show('4.5');
  expect(ui.getByTestId('starknet-privacy-consent-continue').textContent).toBe(
    ETranslations.global_continue,
  );
  expect(
    ui.getByText(ETranslationsMock.starknet_privacy_consent_visibility),
  ).toBeTruthy();
  expect(
    ui.getByText(ETranslationsMock.starknet_privacy_consent_registration),
  ).toBeTruthy();
  expect(
    ui.getByText(ETranslationsMock.starknet_privacy_consent_public_activity),
  ).toBeTruthy();
  expect(ui.queryByTestId('starknet-privacy-consent-details')).toBeNull();
});

it.each(['0', '4.5', '7.25'])(
  'shows the live fee %s without a hardcoded amount',
  (fee) => {
    const ui = show(fee);
    expect(ui.getByTestId('starknet-privacy-consent-fee').textContent).toBe(
      `${fee} STRK per operation`,
    );
  },
);

it('keeps an unavailable fee visible rather than omitting it or showing zero', () => {
  const ui = show();
  expect(
    ui.getByTestId('starknet-privacy-consent-fee').textContent,
  ).not.toContain('0 STRK');
  expect(ui.getByTestId('starknet-privacy-consent-fee').textContent).toBe(
    ETranslations.global_not_available,
  );
});

it('reveals and copies the complete auditor public key without consenting', () => {
  const ui = show('4.5');
  fireEvent.click(ui.getByTestId('starknet-privacy-consent-details-toggle'));
  expect(
    ui.getByTestId('starknet-privacy-consent-auditor-key').textContent,
  ).toBe(auditorPublicKey);
  fireEvent.click(ui.getByTestId('starknet-privacy-consent-auditor-key-copy'));
  expect(mockCopy).toHaveBeenCalledWith(auditorPublicKey);
  expect(mockClose).not.toHaveBeenCalled();
  expect(
    ui
      .getByTestId('starknet-privacy-consent-continue')
      .hasAttribute('disabled'),
  ).toBe(true);
});

it('requires acknowledgement and resolves consent only on Continue', async () => {
  const ui = show('4.5');
  const button = ui.getByTestId('starknet-privacy-consent-continue');
  fireEvent.click(button);
  expect(mockClose).not.toHaveBeenCalled();
  fireEvent.click(ui.getByTestId('starknet-privacy-consent-checkbox'));
  expect(button.hasAttribute('disabled')).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
  await expect(ui.result).resolves.toBe(true);
});

it('does not treat closing the dialog as consent', async () => {
  const ui = show('4.5');
  await act(async () => mockClose());
  await expect(ui.result).resolves.toBe(false);
});

it('shows a no-fee resume consent without a registration fee quote', () => {
  void showStarknetPrivacyConsentDialog({
    intl,
    config,
    protocolFee: '4.5',
    isResuming: true,
  });
  const ui = render(<>{mockDialogOptions?.renderContent}</>);
  expect(ui.getByTestId('starknet-privacy-resume-no-fee').textContent).toBe(
    ETranslationsMock.starknet_privacy_resume_no_fee,
  );
  expect(ui.queryByTestId('starknet-privacy-consent-fee')).toBeNull();
});
