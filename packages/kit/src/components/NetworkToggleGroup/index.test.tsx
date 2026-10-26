import type { ComponentProps } from 'react';

import NetworkToggleGroup from '.';

import { fireEvent, render } from '@testing-library/react-native';

import type { View } from 'react-native';

const mockOnNetworkItemMount = jest.fn();

jest.mock('react-native', () => {
  const actual =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { ...actual, useWindowDimensions: () => ({ width: 400 }) };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    XStack: ({ children, ...props }: ComponentProps<typeof View>) =>
      react.createElement('View', props, children),
    Stack: ({ children, ...props }: ComponentProps<typeof View>) =>
      react.createElement('View', props, children),
    useMedia: () => ({ gtMd: false }),
  };
});

jest.mock('../NetworksFilterItem', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    NetworksFilterItem: function MockNetworksFilterItem({
      testID,
      onLayout,
      networkName,
      width,
      onPress,
    }: {
      testID?: string;
      onLayout?: ComponentProps<typeof View>['onLayout'];
      networkName?: string;
      width?: number;
      onPress?: () => void;
    }) {
      react.useEffect(() => {
        mockOnNetworkItemMount(testID);
      }, []);
      return react.createElement('View', {
        testID,
        onLayout,
        accessibilityLabel: networkName,
        style: { width },
        onTouchEnd: onPress,
      });
    },
  };
});

const networks = Array.from({ length: 12 }, (_, index) => ({
  networkId: `n${index}`,
  name: `Network ${index}`,
}));
const sameChainNetwork = { networkId: 'same', name: 'Same chain' };

function renderGroup({
  count = 12,
  fitToAvailableWidth = true,
  onMoreNetwork = jest.fn(),
  withSameChain = true,
}: {
  count?: number;
  fitToAvailableWidth?: boolean;
  onMoreNetwork?: () => void;
  withSameChain?: boolean;
} = {}) {
  return render(
    <NetworkToggleGroup
      networks={networks.slice(0, count)}
      sameChainNetwork={withSameChain ? sameChainNetwork : undefined}
      maxVisibleNetworks={4}
      fitToAvailableWidth={fitToAvailableWidth}
      onSelectNetwork={jest.fn()}
      onMoreNetwork={onMoreNetwork}
      testIDPrefix="fit"
    />,
  );
}

function measure(
  screen: ReturnType<typeof renderGroup>,
  availableWidth: number,
) {
  const sameChain = screen.queryByTestId('fit-same');
  if (sameChain) {
    fireEvent(sameChain, 'layout', {
      nativeEvent: { layout: { width: 100 } },
    });
  }
  const firstIcon = screen.queryByTestId('fit-n0');
  if (firstIcon?.props.onLayout) {
    fireEvent(firstIcon, 'layout', {
      nativeEvent: { layout: { width: 42 } },
    });
  }
  fireEvent(screen.getByTestId('fit-layout'), 'layout', {
    nativeEvent: { layout: { width: availableWidth } },
  });
}

describe('NetworkToggleGroup available width', () => {
  beforeEach(() => mockOnNetworkItemMount.mockClear());

  it('shows the greatest fitting icon count and a fixed More button', () => {
    const screen = renderGroup();
    measure(screen, 500);

    expect(screen.queryByTestId('fit-n6')).toBeTruthy();
    expect(screen.queryByTestId('fit-n7')).toBeNull();
    expect(screen.getByTestId('fit-n0').props.style?.width).toBe(42);
    expect(screen.getByTestId('fit-more').props.accessibilityLabel).toBe('5+');
    expect(screen.getByTestId('fit-more').props.style?.width).toBe(56);
  });

  it('shows every icon without More when they all fit', () => {
    const screen = renderGroup();
    measure(screen, 700);

    expect(screen.getByTestId('fit-n11')).toBeTruthy();
    expect(screen.queryByTestId('fit-more')).toBeNull();
  });

  it('keeps More when no network icon fits', () => {
    const onMoreNetwork = jest.fn();
    const screen = renderGroup({ onMoreNetwork });
    measure(screen, 150);

    expect(screen.queryByTestId('fit-n0')).toBeNull();
    expect(screen.getByTestId('fit-more').props.accessibilityLabel).toBe('12+');
    fireEvent(screen.getByTestId('fit-more'), 'touchEnd');
    expect(onMoreNetwork).toHaveBeenCalledTimes(1);
  });

  it('ignores a compressed SameChain measurement and restores its natural width', () => {
    const screen = renderGroup();
    measure(screen, 150);
    fireEvent(screen.getByTestId('fit-same'), 'layout', {
      nativeEvent: { layout: { width: 20 } },
    });
    expect(screen.queryByTestId('fit-n0')).toBeNull();

    fireEvent(screen.getByTestId('fit-layout'), 'layout', {
      nativeEvent: { layout: { width: 500 } },
    });
    expect(screen.getByTestId('fit-n6')).toBeTruthy();
    expect(screen.queryByTestId('fit-n7')).toBeNull();
  });

  it('uses uniform icon slots even when the first network lacks a logo', () => {
    const screen = renderGroup({ withSameChain: false });
    measure(screen, 500);
    expect(screen.getByTestId('fit-n0').props.style?.width).toBe(42);
    expect(screen.getByTestId('fit-n8')).toBeTruthy();
    expect(screen.queryByTestId('fit-n9')).toBeNull();
    expect(screen.getByTestId('fit-more').props.accessibilityLabel).toBe('3+');
  });

  it('remeasures when SameChain is removed or its badge text changes', () => {
    const screen = renderGroup();
    measure(screen, 500);
    expect(screen.queryByTestId('fit-n7')).toBeNull();

    screen.rerender(
      <NetworkToggleGroup
        networks={networks}
        maxVisibleNetworks={4}
        fitToAvailableWidth
        onSelectNetwork={jest.fn()}
        onMoreNetwork={jest.fn()}
        testIDPrefix="fit"
      />,
    );
    expect(screen.getByTestId('fit-n8')).toBeTruthy();

    screen.rerender(
      <NetworkToggleGroup
        networks={networks}
        sameChainNetwork={sameChainNetwork}
        sameChainBadgeText="longer badge"
        maxVisibleNetworks={4}
        fitToAvailableWidth
        onSelectNetwork={jest.fn()}
        onMoreNetwork={jest.fn()}
        testIDPrefix="fit"
      />,
    );
    fireEvent(screen.getByTestId('fit-same'), 'layout', {
      nativeEvent: { layout: { width: 180 } },
    });
    expect(screen.getByTestId('fit-n4')).toBeTruthy();
    expect(screen.queryByTestId('fit-n5')).toBeNull();
  });

  it('remounts SameChain for a changed measurement key even at equal width', () => {
    const screen = renderGroup();
    measure(screen, 500);
    const countMounts = () =>
      mockOnNetworkItemMount.mock.calls.filter(([id]) => id === 'fit-same')
        .length;
    expect(countMounts()).toBe(1);

    screen.rerender(
      <NetworkToggleGroup
        networks={networks}
        sameChainNetwork={sameChainNetwork}
        sameChainBadgeText="new text at the same measured width"
        maxVisibleNetworks={4}
        fitToAvailableWidth
        onSelectNetwork={jest.fn()}
        onMoreNetwork={jest.fn()}
        testIDPrefix="fit"
      />,
    );
    expect(countMounts()).toBe(2);
  });

  it('recomputes after the container width changes', () => {
    const screen = renderGroup();
    measure(screen, 500);
    expect(screen.queryByTestId('fit-n7')).toBeNull();

    fireEvent(screen.getByTestId('fit-layout'), 'layout', {
      nativeEvent: { layout: { width: 700 } },
    });
    expect(screen.getByTestId('fit-n11')).toBeTruthy();
    expect(screen.queryByTestId('fit-more')).toBeNull();
  });

  it('does not change icon capacity when the hidden count crosses ten', () => {
    const screen = renderGroup({ count: 10 });
    measure(screen, 210);
    expect(screen.getByTestId('fit-n0')).toBeTruthy();
    expect(screen.queryByTestId('fit-n1')).toBeNull();
    expect(screen.getByTestId('fit-more').props.accessibilityLabel).toBe('9+');

    screen.rerender(
      <NetworkToggleGroup
        networks={networks.slice(0, 11)}
        sameChainNetwork={sameChainNetwork}
        maxVisibleNetworks={4}
        fitToAvailableWidth
        onSelectNetwork={jest.fn()}
        onMoreNetwork={jest.fn()}
        testIDPrefix="fit"
      />,
    );
    expect(screen.getByTestId('fit-n0')).toBeTruthy();
    expect(screen.queryByTestId('fit-n1')).toBeNull();
    expect(screen.getByTestId('fit-more').props.accessibilityLabel).toBe('10+');
  });

  it('preserves the existing max count when fitting is disabled', () => {
    const screen = renderGroup({ fitToAvailableWidth: false });
    expect(screen.getByTestId('fit-n3')).toBeTruthy();
    expect(screen.queryByTestId('fit-n4')).toBeNull();
    expect(screen.getByTestId('fit-more').props.accessibilityLabel).toBe('8+');
  });
});
