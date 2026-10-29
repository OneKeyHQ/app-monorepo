/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { IBorrowBalance } from '@onekeyhq/shared/types/staking';

import { AssetWithAmountField } from './AssetWithAmountField';

jest.mock('@onekeyhq/components', () => {
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return { Image: () => null, SizableText: Text, XStack: Text, YStack: Text };
});
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: { text: string } }) => (
      <span>{text?.text}</span>
    ),
  }),
);
jest.mock('../BorrowAssetToken', () => ({ BorrowAssetToken: () => null }));
jest.mock('./CollateralBadge', () => ({ CollateralBadge: () => null }));
jest.mock('./BorrowBalanceText', () => ({
  BorrowBalanceText: ({ text }: { text: { text: string } }) => (
    <span>{text.text}</span>
  ),
}));

it('keeps rendering an asset when its optional display description is absent', () => {
  const balance = { title: { text: '1.25' } } as IBorrowBalance;
  const { container } = render(
    <AssetWithAmountField
      token={{ symbol: 'TOKEN', logoURI: '' }}
      balance={balance}
    />,
  );
  expect(container.textContent).toContain('TOKEN');
  expect(container.textContent).toContain('1.25');
});
