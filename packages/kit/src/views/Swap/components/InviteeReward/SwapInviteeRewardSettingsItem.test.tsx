/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@onekeyhq/components', () => {
  const close = jest.fn(() => Promise.resolve());
  return {
    __close: close,
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    XStack: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      onPress ? (
        <button data-testid={testID} onClick={onPress} type="button">
          {children}
        </button>
      ) : (
        <div data-testid={testID}>{children}</div>
      ),
    useDialogInstance: () => ({ close }),
  };
});

jest.mock('./SwapInviteeRewardActionButton', () => {
  const showSwapInviteeReward = jest.fn();
  return {
    __showSwapInviteeReward: showSwapInviteeReward,
    useSwapInviteeRewardAction: () => ({
      showSwapInviteeReward,
      title: 'Swap reward',
    }),
  };
});

import { SwapTestIDs } from '../../testIDs';

import { SwapInviteeRewardSettingsItem } from './SwapInviteeRewardSettingsItem';

function getMocks() {
  return {
    close: jest.requireMock('@onekeyhq/components').__close as jest.Mock,
    showSwapInviteeReward: jest.requireMock('./SwapInviteeRewardActionButton')
      .__showSwapInviteeReward as jest.Mock,
  };
}

describe('SwapInviteeRewardSettingsItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes settings before opening rewards', async () => {
    const mocks = getMocks();
    render(<SwapInviteeRewardSettingsItem />);

    fireEvent.click(screen.getByTestId(SwapTestIDs.inviteeRewardSettingsItem));

    await waitFor(() => {
      expect(mocks.showSwapInviteeReward).toHaveBeenCalledTimes(1);
    });
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.showSwapInviteeReward.mock.invocationCallOrder[0],
    );
  });
});
