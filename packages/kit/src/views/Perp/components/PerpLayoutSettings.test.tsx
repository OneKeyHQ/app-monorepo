/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, within } from '@testing-library/react';

import {
  PerpLayoutSettingsContent,
  PerpLayoutSettingsEntry,
  PerpPositionActionsSettingsContent,
  showPerpLayoutSettingsDialog,
} from './PerpLayoutSettings';

const mockSetPerpsCustomSettings = jest.fn();
const mockOnOpen = jest.fn();
const mockLayoutSettingsTourVisited = jest.fn();

let mockChartPosition: 'top' | 'bottom' | 'hidden' | undefined = 'bottom';
let mockLayoutSettingsIsFirstVisit = true;
let mockPositionActionVisibility:
  | Partial<Record<'add' | 'tpsl' | 'close' | 'reverse', boolean>>
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({ id }: { id: string }) => {
      const labels: Record<string, string> = {
        global_top: '顶部',
        global_bottom: '底部',
        perps_layout_settings__title: '布局设置',
        perps_trading_page_chart__title: '交易页 K 线',
        perps_chart_do_not_show__action: '不展示',
        perp_position_action_buttons__title: '持仓操作按钮',
        perp_reverse_position__action: '反向',
      };
      return labels[id] ?? id;
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const mockDialogShow = jest.fn();
  const Stack = ({
    accessibilityRole,
    accessibilityState,
    backgroundColor,
    borderColor,
    borderWidth,
    children,
    onPress,
    testID,
  }: {
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean };
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number | string;
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    const Element = onPress ? 'button' : 'div';
    return (
      <Element
        aria-checked={accessibilityState?.selected}
        data-background-color={backgroundColor}
        data-border-color={borderColor}
        data-border-width={borderWidth}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole === 'radio' ? 'radio' : undefined}
        type={onPress ? 'button' : undefined}
      >
        {children}
      </Element>
    );
  };

  return {
    Dialog: { show: mockDialogShow },
    ESwitchSize: { large: 'large' },
    Switch: ({
      value,
      onChange,
      testID,
    }: {
      value: boolean;
      onChange: (value: boolean) => void;
      testID: string;
    }) => (
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testID}
      />
    ),
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Stack,
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit/src/components/Spotlight', () => ({
  useSpotlight: () => ({
    isFirstVisit: mockLayoutSettingsIsFirstVisit,
    tourTimes: mockLayoutSettingsIsFirstVisit ? 0 : 1,
    tourVisited: mockLayoutSettingsTourVisited,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => [
    {
      chartPosition: mockChartPosition,
      positionActionVisibility: mockPositionActionVisibility,
      showChartLines: true,
      showTradeMarks: true,
      skipOrderConfirm: false,
    },
    mockSetPerpsCustomSettings,
  ],
}));

jest.mock('../utils/styleUtils', () => ({
  getTradingButtonStyleValues: (side: 'long' | 'short') => ({
    bg: side === 'long' ? '$bgAccent' : '$bgCriticalStrong',
  }),
}));

jest.mock('../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children?: ReactNode }) => children,
}));

describe('PerpLayoutSettings', () => {
  beforeEach(() => {
    mockChartPosition = 'bottom';
    mockPositionActionVisibility = undefined;
    mockSetPerpsCustomSettings.mockReset();
    mockOnOpen.mockReset();
    mockLayoutSettingsTourVisited.mockReset();
    mockLayoutSettingsIsFirstVisit = true;
  });

  it('opens layout settings from the menu entry', () => {
    const view = render(
      <PerpLayoutSettingsEntry onPress={mockOnOpen} showFeatureDot />,
    );

    fireEvent.click(view.getByTestId('perp-mobile-layout-settings-button'));

    expect(mockOnOpen).toHaveBeenCalledTimes(1);
    expect(mockLayoutSettingsTourVisited).toHaveBeenCalledTimes(1);
    expect(view.getByText('布局设置')).toBeTruthy();
    expect(
      view.container.querySelector('[data-icon="ChevronRightOutline"]'),
    ).toBeTruthy();
    expect(
      view.getByTestId('perp-mobile-layout-settings-feature-dot'),
    ).toBeTruthy();
  });

  it('hides the feature dot after layout settings is visited', () => {
    mockLayoutSettingsIsFirstVisit = false;
    const view = render(
      <PerpLayoutSettingsEntry onPress={mockOnOpen} showFeatureDot />,
    );

    fireEvent.click(view.getByTestId('perp-mobile-layout-settings-button'));

    expect(
      view.queryByTestId('perp-mobile-layout-settings-feature-dot'),
    ).toBeNull();
    expect(mockLayoutSettingsTourVisited).not.toHaveBeenCalled();
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });

  it('opens chart positions in a standalone dialog', () => {
    const { Dialog } = jest.requireMock('@onekeyhq/components');

    showPerpLayoutSettingsDialog({
      title: '布局设置',
      positionActionsTitle: '持仓操作按钮',
    });

    expect(Dialog.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '布局设置',
        showFooter: false,
        renderContent: expect.any(Object),
      }),
    );
  });

  it('renders all chart positions and highlights the saved preference', () => {
    const view = render(<PerpLayoutSettingsContent />);
    const top = view.getByTestId('perp-mobile-chart-position-option-top');
    const bottom = view.getByTestId('perp-mobile-chart-position-option-bottom');
    const hidden = view.getByTestId('perp-mobile-chart-position-option-hidden');

    expect(view.getByText('交易页 K 线')).toBeTruthy();
    expect(top.getAttribute('aria-checked')).toBe('false');
    expect(top.getAttribute('data-border-color')).toBe('$borderSubdued');
    expect(within(top).queryByText('顶部')).toBeNull();
    expect(bottom.getAttribute('aria-checked')).toBe('true');
    expect(bottom.getAttribute('data-border-width')).toBe('$px');
    expect(bottom.getAttribute('data-border-color')).toBe('$borderActive');
    expect(hidden.getAttribute('aria-checked')).toBe('false');
    expect(within(bottom).queryByText('底部')).toBeNull();
    expect(within(hidden).queryByText('不展示')).toBeNull();
    expect(view.getByText('不展示')).toBeTruthy();
  });

  it('defaults to the bottom position without a saved preference', () => {
    mockChartPosition = undefined;
    const view = render(<PerpLayoutSettingsContent />);
    const top = view.getByTestId('perp-mobile-chart-position-option-top');
    const bottom = view.getByTestId('perp-mobile-chart-position-option-bottom');

    expect(top.getAttribute('aria-checked')).toBe('false');
    expect(bottom.getAttribute('aria-checked')).toBe('true');
    expect(bottom.getAttribute('data-border-color')).toBe('$borderActive');
  });

  it('persists the selected chart position', () => {
    const view = render(<PerpLayoutSettingsContent />);

    fireEvent.click(view.getByTestId('perp-mobile-chart-position-option-top'));
    expect(mockSetPerpsCustomSettings).toHaveBeenCalledTimes(1);

    const update = mockSetPerpsCustomSettings.mock.calls[0][0] as (current: {
      chartPosition: 'bottom';
      untouched: boolean;
    }) => { chartPosition: 'top'; untouched: boolean };
    expect(update({ chartPosition: 'bottom', untouched: true })).toEqual({
      chartPosition: 'top',
      untouched: true,
    });
  });
});

describe('position action settings', () => {
  beforeEach(() => {
    mockPositionActionVisibility = undefined;
    mockSetPerpsCustomSettings.mockReset();
  });
  it('opens the button settings entry', () => {
    const onOpen = jest.fn();
    const view = render(
      <PerpLayoutSettingsContent onOpenPositionActions={onOpen} />,
    );
    fireEvent.click(view.getByTestId('perp-position-actions-settings-button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(view.getByText('持仓操作按钮')).toBeTruthy();
  });
  it('defaults every action to visible for old preferences', () => {
    const view = render(<PerpPositionActionsSettingsContent />);
    expect(view.getByText('反向')).toBeTruthy();
    expect(
      view
        .getAllByRole('checkbox')
        .every((input) => (input as HTMLInputElement).checked),
    ).toBe(true);
  });
  it('preserves other settings and allows disabling the final visible action', () => {
    mockPositionActionVisibility = {
      add: false,
      tpsl: false,
      close: false,
      reverse: true,
    };
    const view = render(<PerpPositionActionsSettingsContent />);
    fireEvent.click(view.getByTestId('perp-position-action-switch-reverse'));
    const previous = {
      chartPosition: 'top',
      positionActionVisibility: mockPositionActionVisibility,
    };
    const update = mockSetPerpsCustomSettings.mock.calls[0][0] as (
      current: typeof previous,
    ) => typeof previous;
    expect(update(previous)).toEqual({
      chartPosition: 'top',
      positionActionVisibility: {
        add: false,
        tpsl: false,
        close: false,
        reverse: false,
      },
    });
  });
});
