/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import { TradingViewNativeFullscreenButton } from './TradingViewNativeFullscreenButton.native';

const mockIconButton = jest.fn<null, [Record<string, unknown>]>(() => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  IconButton: (props: Record<string, unknown>) => mockIconButton(props),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_collapse: 'global_collapse',
    global_expand: 'global_expand',
  },
}));

jest.mock(
  '../TradingViewChartControls/utils/NativeChartControlsShared',
  () => ({
    HEADER_ICON_BUTTON_STYLE_PROPS: {},
  }),
);

describe('TradingViewNativeFullscreenButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('positions fullscreen controls from chart geometry only', () => {
    render(
      <TradingViewNativeFullscreenButton
        chartHeight={300}
        isFullscreen
        onPress={jest.fn()}
        timeAxisHeight={20}
        visibleSubIndicatorCount={0}
      />,
    );

    expect(mockIconButton.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        bottom: 28,
        icon: 'TradingViewExitFullscreenCustom',
        left: '$5',
      }),
    );
  });
});
