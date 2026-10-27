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

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ACTIVITY_HUB_PANEL_WIDTH } from './layout';
import { useShowActivityHub } from './useShowActivityHub';

function showHub() {
  const { result } = renderHook(() => useShowActivityHub());

  result.current({
    source: 'Swap',
    onOpenReferral: jest.fn(),
  });

  return mockDialogShow.mock.calls[0][0] as {
    title: string;
    floatingPanelProps?: { width: number };
    renderContent: ReactElement;
  };
}

describe('useShowActivityHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGtMd = true;
  });

  it.each([
    {
      panel: 'a floating panel above md',
      gtMd: true,
      floatingPanelProps: { width: ACTIVITY_HUB_PANEL_WIDTH },
    },
    {
      panel: 'an unsized sheet below md',
      gtMd: false,
      floatingPanelProps: undefined,
    },
  ])('is $panel', ({ gtMd, floatingPanelProps }) => {
    mockGtMd = gtMd;

    const options = showHub();

    expect(options.floatingPanelProps).toEqual(floatingPanelProps);
    expect(options.title).toBe(ETranslations.referral_home__title);
  });
});
