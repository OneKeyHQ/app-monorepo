/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerRewardCenter.test.tsx
*/
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { AccountSelectorTriggerRewardCenter } from './AccountSelectorTriggerRewardCenter';

// The `closePopover` each render of the popover content was given.
let capturedCloses: (() => void)[] = [];
let capturedOnOpenChange: ((open: boolean) => void) | undefined;

jest.mock('@onekeyhq/components', () => ({
  Popover: ({
    open,
    onOpenChange,
    renderTrigger,
    renderContent,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    renderTrigger: ReactNode;
    renderContent: (props: { closePopover: () => void }) => ReactNode;
  }) => {
    capturedOnOpenChange = onOpenChange;
    return (
      <>
        {renderTrigger}
        {open
          ? renderContent({ closePopover: () => onOpenChange(false) })
          : null}
      </>
    );
  },
  Spinner: () => null,
  YStack: ({ children }: { children?: ReactNode }) => children ?? null,
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true, isWeb: false },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorContextData: () => ({
    config: { sceneName: 'rewardCenter' },
  }),
}));

jest.mock('../AccountSelectorProvider', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children ?? null,
}));

jest.mock('./AccountSelectorTriggerBase', () => ({
  AccountSelectorTriggerBase: ({ onPress }: { onPress?: () => void }) => (
    <button type="button" data-testid="trigger" onClick={onPress}>
      account
    </button>
  ),
}));

jest.mock('./AccountSelectorRewardPopoverContent', () => ({
  __esModule: true,
  default: ({ closePopover }: { closePopover: () => void }) => {
    capturedCloses.push(closePopover);
    return <div data-testid="content" />;
  },
}));

async function openPopover() {
  fireEvent.click(screen.getByTestId('trigger'));
  await screen.findByTestId('content');
  const close = capturedCloses.at(-1);
  expect(close).toBeDefined();
  return close as () => void;
}

describe('AccountSelectorTriggerRewardCenter popover', () => {
  beforeEach(() => {
    capturedCloses = [];
    capturedOnOpenChange = undefined;
  });

  it('closes the popover from its content', async () => {
    render(<AccountSelectorTriggerRewardCenter num={0} compact />);
    const close = await openPopover();

    act(() => close());

    expect(screen.queryByTestId('content')).toBeNull();
  });

  // Creating an address outlives the popover it was started from. When that
  // popover was dismissed and another one opened meanwhile, the completion
  // of the first must not close the second under the user's hands.
  it('ignores a close that belongs to an earlier opening', async () => {
    render(<AccountSelectorTriggerRewardCenter num={0} compact />);
    const closeOfFirstOpening = await openPopover();
    act(() => capturedOnOpenChange?.(false));
    expect(screen.queryByTestId('content')).toBeNull();

    const closeOfSecondOpening = await openPopover();
    act(() => closeOfFirstOpening());
    expect(screen.getByTestId('content')).toBeTruthy();

    act(() => closeOfSecondOpening());
    expect(screen.queryByTestId('content')).toBeNull();
  });
});
