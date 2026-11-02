/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PrivacyEnableDisclosure } from './LocalWalletRepairControls';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return { SizableText: container, YStack: container };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

// Only where enabling asks the device (Monero); Zcash's device gave the key
// when the account was created.
it.each([
  ['hw-1--m/44/128/0', true, true],
  ['hw-1--m/44/128/0', false, false],
  ['hd-1--m/44/128/0', true, false],
])(
  'explains the view key export for %s (device asked: %s): %s',
  (accountId, deviceExportsViewKey, shown) => {
    const result = render(
      <PrivacyEnableDisclosure
        accountId={accountId}
        deviceExportsViewKey={deviceExportsViewKey}
        hasRecommendedMonth={false}
      />,
    );
    expect(
      !!result.queryByText(ETranslations.privacy_enable_device_view_key__msg),
    ).toBe(shown);
  },
);
