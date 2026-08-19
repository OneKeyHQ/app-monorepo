/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';

const mockDialogShow = jest.fn();
let mockGtMd = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (props: unknown) => {
      mockDialogShow(props);
    },
  },
  useDialogInstance: () => ({ close: jest.fn() }),
  useMedia: () => ({ gtMd: mockGtMd }),
}));

jest.mock('./ActivityHubContent', () => ({
  ActivityHubContent: () => null,
}));

import { getActivityHubLayout } from './layout';
import { useShowActivityHub } from './useShowActivityHub';

import type { IActivityHubCampaign } from './types';

const CAMPAIGNS: IActivityHubCampaign[] = [
  {
    id: 'campaign-1',
    title: 'campaign title',
    subtitle: 'campaign subtitle',
    url: 'https://onekey.so',
  },
];

function showHub(campaigns?: IActivityHubCampaign[]) {
  const { result } = renderHook(() => useShowActivityHub());

  result.current({
    source: 'Swap',
    copyAsUrl: true,
    onOpenInviteeReward: jest.fn(),
    campaigns,
  });

  return mockDialogShow.mock.calls[0][0] as {
    floatingPanelProps?: { width: number };
    renderContent: ReactElement<{ isCompactPanel: boolean }>;
  };
}

describe('useShowActivityHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGtMd = true;
  });

  // Dialog keeps rendering a floating panel above the md breakpoint on native
  // tablets too, so neither the width nor the basis may be gated on platform.
  it('pairs the compact panel width with the compact tile basis', () => {
    const compactPanel = getActivityHubLayout(false);
    const options = showHub();

    expect(options.floatingPanelProps).toEqual({
      width: compactPanel.panelWidth,
    });
    expect(options.renderContent.props.isCompactPanel).toBe(true);
  });

  it('widens the panel when campaign cards are shown', () => {
    const widePanel = getActivityHubLayout(true);
    const options = showHub(CAMPAIGNS);

    expect(options.floatingPanelProps).toEqual({ width: widePanel.panelWidth });
    expect(options.renderContent.props.isCompactPanel).toBe(false);
  });

  it('leaves the md sheet unsized and non-compact', () => {
    mockGtMd = false;
    const options = showHub();

    expect(options.floatingPanelProps).toBeUndefined();
    expect(options.renderContent.props.isCompactPanel).toBe(false);
  });
});
