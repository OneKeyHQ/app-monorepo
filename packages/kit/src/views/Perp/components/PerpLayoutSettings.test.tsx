/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, within } from '@testing-library/react';

import {
  PerpLayoutSettingsContent,
  PerpLayoutSettingsEntry,
  showPerpLayoutSettingsDialog,
} from './PerpLayoutSettings';

const mockSetPerpsCustomSettings = jest.fn();
const mockOnOpen = jest.fn();

let mockChartPosition: 'top' | 'bottom' | 'hidden' | undefined = 'bottom';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({ id }: { id: string }) => {
      const labels: Record<string, string> = {
        global_top: '顶部',
        global_bottom: '底部',
        'market.chart_settings__none': '无',
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
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Stack,
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => [
    {
      chartPosition: mockChartPosition,
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
    mockSetPerpsCustomSettings.mockReset();
    mockOnOpen.mockReset();
  });

  it('opens layout settings from the menu entry', () => {
    const view = render(<PerpLayoutSettingsEntry onPress={mockOnOpen} />);

    fireEvent.click(view.getByTestId('perp-mobile-layout-settings-button'));

    expect(mockOnOpen).toHaveBeenCalledTimes(1);
    expect(view.getByText('布局设置')).toBeTruthy();
    expect(
      view.container.querySelector('[data-icon="ChevronRightOutline"]'),
    ).toBeTruthy();
  });

  it('opens chart positions in a standalone dialog', () => {
    const { Dialog } = jest.requireMock('@onekeyhq/components');

    showPerpLayoutSettingsDialog({ title: '布局设置' });

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
