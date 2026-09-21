/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { fireEvent, render, screen } from '@testing-library/react';

import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { showLabelSetDialog } from './HardwareLabelSetDialog';
import { getHardwareLabelValidationError } from './hardwareLabelValidation';
import { WalletRenameButton } from './WalletRenameButton';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  XStack: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Icon: () => null,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceAccount: {} },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersWallet: () => false,
    isHwWallet: () => true,
    isHwHiddenWallet: () => false,
  },
}));
jest.mock('@onekeyhq/kit/src/components/RenameDialog', () => ({
  showRenameDialog: jest.fn(),
}));
jest.mock('./HardwareLabelSetDialog', () => ({
  showLabelSetDialog: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

it.each([
  [EHardwareVendor.onekey, EDeviceType.Pro2, true],
  [EHardwareVendor.onekey, EDeviceType.Neo, true],
  [undefined, EDeviceType.Pro2, true],
  [EHardwareVendor.onekey, EDeviceType.Pro, false],
  [EHardwareVendor.trezor, undefined, true],
] as const)(
  'passes the correct label restriction for %s/%s',
  (vendor, deviceType, asciiOnly) => {
    const wallet = {
      id: 'hw--test',
      name: 'Test wallet',
      type: 'hw',
      associatedDeviceInfo: { vendor, deviceType },
    } as IDBWallet;
    render(<WalletRenameButton wallet={wallet} editable />);
    fireEvent.click(screen.getByRole('button'));
    const [params] = jest.mocked(showLabelSetDialog).mock.calls[0];
    expect(params.asciiOnly).toBe(asciiOnly);
    expect(
      getHardwareLabelValidationError({
        value: '中文',
        maxLength: 14,
        asciiOnly: params.asciiOnly,
      }),
    ).toBe(asciiOnly ? 'invalid' : undefined);
    expect(showRenameDialog).not.toHaveBeenCalled();
  },
);

it.each([EHardwareVendor.ledger, EHardwareVendor.keystone])(
  'keeps %s names local',
  (vendor) => {
    const wallet = {
      id: 'hw--test',
      name: 'Test wallet',
      type: 'hw',
      associatedDeviceInfo: { vendor },
    } as IDBWallet;
    render(<WalletRenameButton wallet={wallet} editable />);
    fireEvent.click(screen.getByRole('button'));
    expect(showLabelSetDialog).not.toHaveBeenCalled();
    expect(showRenameDialog).toHaveBeenCalled();
  },
);
