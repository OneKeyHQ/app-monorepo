/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const close = jest.fn(() => Promise.resolve());
  return {
    __close: close,
    useDialogInstance: () => ({ close }),
  };
});

const mockShowActivityHub = jest.fn();

jest.mock('@onekeyhq/kit/src/components/ActivityHub', () => ({
  useShowActivityHub: () => mockShowActivityHub,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    onPress,
    testID,
    title,
  }: {
    onPress?: () => void;
    testID?: string;
    title?: ReactNode;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {title}
    </button>
  ),
}));

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SwapTestIDs } from '../../testIDs';

import { SwapActivityHubSettingsItem } from './SwapActivityHubSettingsItem';

function getCloseMock() {
  return jest.requireMock('@onekeyhq/components').__close as jest.Mock;
}

describe('SwapActivityHubSettingsItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNative = false;
  });

  it('closes the settings sheet before opening the hub on pointer layouts', async () => {
    const close = getCloseMock();
    const onOpenReferral = jest.fn();

    render(<SwapActivityHubSettingsItem onOpenReferral={onOpenReferral} />);

    const entry = screen.getByTestId(SwapTestIDs.activityHubSettingsItem);
    expect(entry.textContent).toBe(ETranslations.perps_activity_hub);

    fireEvent.click(entry);

    await waitFor(() => {
      expect(mockShowActivityHub).toHaveBeenCalledWith({
        source: 'Swap',
        onOpenReferral,
      });
    });
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(
      mockShowActivityHub.mock.invocationCallOrder[0],
    );
    expect(onOpenReferral).not.toHaveBeenCalled();
  });

  it('closes the settings sheet before opening the referral page on native', async () => {
    platformEnv.isNative = true;
    const close = getCloseMock();
    const onOpenReferral = jest.fn();

    render(
      <SwapActivityHubSettingsItem onOpenReferral={onOpenReferral} />,
    );

    const entry = screen.getByTestId(SwapTestIDs.activityHubSettingsItem);
    expect(entry.textContent).toBe(ETranslations.sidebar_refer_a_friend);

    fireEvent.click(entry);

    await waitFor(() => {
      expect(onOpenReferral).toHaveBeenCalledTimes(1);
    });
    expect(mockShowActivityHub).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(
      onOpenReferral.mock.invocationCallOrder[0],
    );
  });
});
