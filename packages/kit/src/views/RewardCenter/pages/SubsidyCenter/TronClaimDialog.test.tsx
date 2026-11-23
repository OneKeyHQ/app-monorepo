/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/TronClaimDialog.test.tsx
*/
import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { TronClaimView } from './TronClaimDialog';

import type { ITronRewardCardState } from '../RewardCenter';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => ({ hostKey: undefined, ownerKey: undefined }),
}));

jest.mock('@onekeyhq/components', () => {
  const Null = () => null;
  const Container = ({
    testID,
    children,
  }: {
    testID?: string;
    children?: ReactNode;
  }) => <div data-testid={testID}>{children}</div>;
  const Scroll = ({ children }: { children?: ReactNode }) => (
    <div data-testid="scroll">{children}</div>
  );
  return {
    Alert: ({ title, testID }: { title?: string; testID?: string }) => (
      <div data-testid={testID}>{title}</div>
    ),
    Dialog: { ScrollView: Scroll },
    DialogContainer: ({
      renderContent,
      leadingContent,
    }: {
      renderContent?: ReactNode;
      leadingContent?: ReactNode;
    }) => (
      <>
        {renderContent}
        {leadingContent}
      </>
    ),
    Icon: Null,
    ScrollView: Scroll,
    SegmentControl: ({
      options,
      onChange,
    }: {
      options: { value: string; testID: string }[];
      onChange: (value: string) => void;
    }) => (
      <>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={option.testID}
            onClick={() => onChange(option.value)}
          >
            {option.value}
          </button>
        ))}
      </>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: Object.assign(Null, { BodyMd: Null }),
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('./InventoryProgress', () => ({
  InventoryProgress: () => null,
}));

const details: ITronRewardCardState['claimDetails'] = {
  remaining: 120,
  total: 500,
  monthlyRemaining: 10,
  monthlyLimit: 10,
  inventoryLoading: false,
  inventoryFallback: null,
  accountSelector: <span>account</span>,
  accountNotice: 'account-notice',
  claimButton: <span>claim-action</span>,
  redeemField: <span>redeem-field</span>,
  redeemButton: <span>redeem-action</span>,
};

const REDEEM_TAB = 'subsidy-tron-tab-redeem';
const NOTICE = 'subsidy-tron-account-notice';
const sheet = { open: true, onClose: jest.fn() };

describe('TronClaimView account notice', () => {
  it.each([
    ['the desktop panel', undefined],
    ['the claim sheet', sheet],
  ])('shows the notice on both tabs of %s', (_name, dialog) => {
    render(<TronClaimView details={details} dialog={dialog} />);
    expect(screen.getByTestId(NOTICE).textContent).toBe('account-notice');
    expect(screen.getByText('claim-action')).toBeTruthy();

    fireEvent.click(screen.getByTestId(REDEEM_TAB));
    expect(screen.getByTestId(NOTICE).textContent).toBe('account-notice');
    expect(screen.getByText('redeem-action')).toBeTruthy();
  });

  // The desktop panel has a fixed height: a notice inside its scrolling
  // content would push the last rows out of view, or sit there half clipped.
  it('keeps the notice of the desktop panel out of the scrolling content', () => {
    render(<TronClaimView details={details} />);
    expect(
      within(screen.getByTestId('scroll')).queryByTestId(NOTICE),
    ).toBeNull();
    expect(screen.getByTestId(NOTICE)).toBeTruthy();
  });

  it('puts the notice of the claim sheet in its content, above the action', () => {
    render(<TronClaimView details={details} dialog={sheet} />);
    expect(
      within(screen.getByTestId('scroll')).getByTestId(NOTICE),
    ).toBeTruthy();
  });

  it.each([
    ['the desktop panel', undefined],
    ['the claim sheet', sheet],
  ])('renders no notice in %s for an account without one', (_name, dialog) => {
    render(
      <TronClaimView
        details={{ ...details, accountNotice: undefined }}
        dialog={dialog}
      />,
    );
    expect(screen.queryByTestId(NOTICE)).toBeNull();
    expect(screen.getByText('account')).toBeTruthy();
    expect(screen.getByText('claim-action')).toBeTruthy();
  });
});
