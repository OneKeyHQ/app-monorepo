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
    useDialogInstance: () => ({ close }),
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    bg,
    hoverStyle,
    nativePressableStyle,
    onPress,
    pressStyle,
    testID,
    title,
  }: {
    bg?: string;
    hoverStyle?: { bg?: string };
    nativePressableStyle?: { flexShrink?: number };
    onPress?: () => void;
    pressStyle?: { bg?: string };
    testID?: string;
    title?: ReactNode;
  }) => (
    <button
      data-bg={bg}
      data-hover-bg={hoverStyle?.bg}
      data-native-flex-shrink={nativePressableStyle?.flexShrink}
      data-press-bg={pressStyle?.bg}
      data-testid={testID}
      onClick={onPress}
      type="button"
    >
      {title}
    </button>
  ),
}));

import { SwapTestIDs } from '../../testIDs';

import { SwapInviteeRewardSettingsItem } from './SwapInviteeRewardSettingsItem';

function getMocks() {
  return {
    close: jest.requireMock('@onekeyhq/components').__close as jest.Mock,
  };
}

describe('SwapInviteeRewardSettingsItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes settings before invoking the page-owned reward action', async () => {
    const mocks = getMocks();
    const onShowSwapInviteeReward = jest.fn();
    render(
      <SwapInviteeRewardSettingsItem
        onShowSwapInviteeReward={onShowSwapInviteeReward}
        title="Swap reward"
      />,
    );

    const entry = screen.getByTestId(SwapTestIDs.inviteeRewardSettingsItem);
    expect(entry.getAttribute('data-bg')).toBe('transparent');
    expect(entry.getAttribute('data-hover-bg')).toBe('transparent');
    expect(entry.getAttribute('data-press-bg')).toBe('transparent');
    expect(entry.getAttribute('data-native-flex-shrink')).toBe('0');

    fireEvent.click(entry);

    await waitFor(() => {
      expect(onShowSwapInviteeReward).toHaveBeenCalledTimes(1);
    });
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
      onShowSwapInviteeReward.mock.invocationCallOrder[0],
    );
  });
});
