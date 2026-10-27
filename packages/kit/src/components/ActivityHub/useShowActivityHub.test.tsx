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

import { ACTIVITY_HUB_PANEL_WIDTH } from './layout';
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
    onOpenReferral: jest.fn(),
    campaigns,
  });

  return mockDialogShow.mock.calls[0][0] as {
    floatingPanelProps?: { width: number };
    renderContent: ReactElement;
  };
}

describe('useShowActivityHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGtMd = true;
  });

  // Unlike a Popover, a Dialog keeps rendering a floating panel above the md
  // breakpoint on native tablets too, so nothing here may be gated on platform.
  it.each([
    {
      panel: 'a floating panel above md without campaigns',
      gtMd: true,
      campaigns: undefined,
      floatingPanelProps: { width: ACTIVITY_HUB_PANEL_WIDTH },
    },
    {
      panel: 'a floating panel above md with campaigns',
      gtMd: true,
      campaigns: CAMPAIGNS,
      floatingPanelProps: { width: ACTIVITY_HUB_PANEL_WIDTH },
    },
    {
      panel: 'an unsized sheet below md',
      gtMd: false,
      campaigns: undefined,
      floatingPanelProps: undefined,
    },
  ])('is $panel', ({ gtMd, campaigns, floatingPanelProps }) => {
    mockGtMd = gtMd;

    const options = showHub(campaigns);

    expect(options.floatingPanelProps).toEqual(floatingPanelProps);
  });
});
