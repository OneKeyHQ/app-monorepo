/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { PerpDesktopLayout } from './PerpDesktopLayout.web';

type IMockLayoutState = {
  chartExpanded?: boolean;
  chartHeight?: number;
  orderBook?: { visible: boolean };
};

type IMockAllotmentProps = {
  children?: ReactNode;
  defaultSizes?: number[];
  id?: string;
  onDragEnd?: (sizes: number[]) => void;
  onDragStart?: (sizes: number[]) => void;
  onReset?: () => void;
  vertical?: boolean;
};

let mockLayoutState: IMockLayoutState;
const mockMarketPanelMount = jest.fn();
const mockMarketPanelUnmount = jest.fn();
const mockAllotmentProps = new Map<string, IMockAllotmentProps>();
const mockAllotmentResize = new Map<string, jest.Mock>();
let mockTheme = {
  borderActive: { val: '#44AAFF' },
  borderStrong: { val: '#334455' },
  borderSubdued: { val: '#223344' },
};

const mockSetLayoutState = jest.fn(
  (updater: (prev: IMockLayoutState) => IMockLayoutState) => {
    mockLayoutState = updater(mockLayoutState);
  },
);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 982, width: 1512 }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = React.forwardRef<
    HTMLDivElement,
    {
      children?: ReactNode;
      style?: React.CSSProperties;
      testID?: string;
    }
  >(({ children, style, testID }, ref) => (
    <div ref={ref} style={style} data-testid={testID}>
      {children}
    </div>
  ));
  Container.displayName = 'MockContainer';
  return {
    IconButton: () => <button type="button">toggle</button>,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Stack: Container,
    XStack: Container,
    YStack: Container,
    useMedia: () => ({ gtXl: true }),
    useTheme: () => mockTheme,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsLayoutStateAtom: () => [mockLayoutState, mockSetLayoutState],
}));

jest.mock('allotment', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Allotment = React.forwardRef<
    { reset: () => void; resize: (sizes: number[]) => void },
    IMockAllotmentProps
  >((props, ref) => {
    const id = props.id ?? 'unknown-allotment';
    mockAllotmentProps.set(id, props);
    const resize = mockAllotmentResize.get(id) ?? jest.fn();
    mockAllotmentResize.set(id, resize);
    React.useImperativeHandle(ref, () => ({
      reset: jest.fn(),
      resize,
    }));
    return <div>{props.children}</div>;
  }) as ReturnType<typeof React.forwardRef> & {
    Pane: ({
      children,
      visible,
    }: {
      children?: ReactNode;
      visible?: boolean;
    }) => ReactNode;
  };
  Allotment.displayName = 'MockAllotment';
  Allotment.Pane = ({ children, visible = true }) => (
    <div hidden={!visible}>{children}</div>
  );
  return { Allotment };
});

jest.mock('../components/FavoritesBar/FavoritesBar.web', () => ({
  FavoritesBar: () => <div>Favorites</div>,
}));
jest.mock('../components/MarketDetail/PerpMarketWorkspacePanel', () => ({
  PerpMarketWorkspacePanel: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockMarketPanelMount();
      return mockMarketPanelUnmount;
    }, []);
    return <div>Market workspace</div>;
  },
}));
jest.mock('../components/OrderInfoPanel/PerpOrderInfoPanel', () => ({
  PerpOrderInfoPanel: () => <div>Order info</div>,
}));
jest.mock('../components/PerpNetworkAlert', () => ({
  PerpNetworkAlert: () => null,
}));
jest.mock('../components/PerpOrderBook', () => ({
  PerpOrderBook: () => <div>Order book</div>,
}));
jest.mock('../components/PerpTips', () => ({ PerpTips: () => null }));
jest.mock('../components/TickerBar/PerpTickerBar', () => ({
  PerpTickerBar: () => <div>Ticker</div>,
}));
jest.mock('../components/TradingPanel/panels/PerpAccountPanel', () => ({
  PerpAccountDebugInfo: () => null,
  PerpAccountPanel: () => <div>Account</div>,
}));
jest.mock('../components/TradingPanel/PerpTradingPanel', () => ({
  PerpTradingPanel: () => <div>Trading</div>,
}));

describe('PerpDesktopLayout web chart split', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllotmentProps.clear();
    mockAllotmentResize.clear();
    mockTheme = {
      borderActive: { val: '#44AAFF' },
      borderStrong: { val: '#334455' },
      borderSubdued: { val: '#223344' },
    };
    mockLayoutState = {
      chartExpanded: false,
      chartHeight: 700,
      orderBook: { visible: true },
    };
  });

  it('renders only the chart/order-info split as draggable', () => {
    render(<PerpDesktopLayout />);

    expect(mockAllotmentProps.size).toBe(1);
    expect(mockAllotmentProps.get('perp-desktop-chart-split')?.vertical).toBe(
      true,
    );
  });

  it('persists the chart height on drag end', () => {
    render(<PerpDesktopLayout />);

    act(() => {
      mockAllotmentProps
        .get('perp-desktop-chart-split')
        ?.onDragEnd?.([640, 428]);
    });
    expect(mockLayoutState.chartHeight).toBe(640);
  });

  it('re-applies the persisted chart height after hydration updates', () => {
    const view = render(<PerpDesktopLayout />);

    expect(
      mockAllotmentResize.get('perp-desktop-chart-split'),
    ).toHaveBeenLastCalledWith([700, 368]);

    mockLayoutState = { ...mockLayoutState, chartHeight: 620 };
    view.rerender(<PerpDesktopLayout />);

    expect(
      mockAllotmentResize.get('perp-desktop-chart-split'),
    ).toHaveBeenLastCalledWith([620, 448]);
  });

  it('keeps the TradingView workspace mounted when fullscreen changes', () => {
    const view = render(<PerpDesktopLayout />);

    expect(mockMarketPanelMount).toHaveBeenCalledTimes(1);
    expect(mockMarketPanelUnmount).not.toHaveBeenCalled();

    mockLayoutState = { ...mockLayoutState, chartExpanded: true };
    view.rerender(<PerpDesktopLayout />);

    expect(mockMarketPanelMount).toHaveBeenCalledTimes(1);
    expect(mockMarketPanelUnmount).not.toHaveBeenCalled();
  });

  it('resets the split immediately before clearing persistence', () => {
    render(<PerpDesktopLayout />);

    act(() => {
      mockAllotmentProps.get('perp-desktop-chart-split')?.onReset?.();
    });

    expect(
      mockAllotmentResize.get('perp-desktop-chart-split'),
    ).toHaveBeenCalledWith([588, 480]);
    expect(mockLayoutState.chartHeight).toBeUndefined();
  });

  it('uses theme tokens for visible and active split lines', () => {
    const view = render(<PerpDesktopLayout />);
    const root = view.getByTestId('perp-desktop-split-root');

    expect(root.style.getPropertyValue('--separator-border')).toBe('#334455');
    expect(root.style.getPropertyValue('--focus-border')).toBe('#44AAFF');

    mockTheme = {
      borderActive: { val: '#0055CC' },
      borderStrong: { val: '#CCDDEE' },
      borderSubdued: { val: '#AABBCC' },
    };
    view.rerender(<PerpDesktopLayout />);

    expect(root.style.getPropertyValue('--separator-border')).toBe('#CCDDEE');
    expect(root.style.getPropertyValue('--focus-border')).toBe('#0055CC');
  });

  it('preserves the themed top border on the order info panel', () => {
    const view = render(<PerpDesktopLayout />);
    const boundary = view.getByTestId('perp-desktop-chart-boundary');

    expect(boundary.style.borderTopColor).toBe('#223344');
    expect(boundary.style.borderTopStyle).toBe('solid');
    expect(boundary.style.borderTopWidth).toBe('1px');

    mockTheme = {
      borderActive: { val: '#0055CC' },
      borderStrong: { val: '#CCDDEE' },
      borderSubdued: { val: '#AABBCC' },
    };
    view.rerender(<PerpDesktopLayout />);

    expect(boundary.style.borderTopColor).toBe('#AABBCC');
  });

  it('shields the TradingView iframe only while the chart split is dragging', () => {
    const view = render(<PerpDesktopLayout />);

    expect(view.queryByTestId('perp-desktop-chart-drag-shield')).toBeNull();

    act(() => {
      mockAllotmentProps
        .get('perp-desktop-chart-split')
        ?.onDragStart?.([588, 480]);
    });

    expect(view.queryByTestId('perp-desktop-chart-drag-shield')).not.toBeNull();

    act(() => {
      mockAllotmentProps
        .get('perp-desktop-chart-split')
        ?.onDragEnd?.([640, 428]);
    });

    expect(view.queryByTestId('perp-desktop-chart-drag-shield')).toBeNull();
  });
});
