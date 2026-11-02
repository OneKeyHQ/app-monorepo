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

// Enabling a hardware account asks its device for the view key.
it.each([
  ['hw-1--m/44/128/0', true],
  ['hd-1--m/44/128/0', false],
])('explains the view key export for %s: %s', (accountId, shown) => {
  const result = render(
    <PrivacyEnableDisclosure
      accountId={accountId}
      hasRecommendedMonth={false}
    />,
  );
  expect(
    !!result.queryByText(ETranslations.privacy_enable_device_view_key__msg),
  ).toBe(shown);
});
