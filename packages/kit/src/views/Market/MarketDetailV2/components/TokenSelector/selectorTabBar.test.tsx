/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { SelectorTabBar } from './selectorTabBar';

const mockSharedValues: { value: string }[] = [];

jest.mock('react-native-reanimated', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (initial: string) => {
      const ref = ReactModule.useRef<{ value: string } | null>(null);
      if (!ref.current) {
        ref.current = { value: initial };
        mockSharedValues.push(ref.current);
      }
      return ref.current;
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const TabBarItem = ({
    name,
    isFocused,
    onPress,
    testID,
  }: {
    name: string;
    isFocused?: boolean;
    onPress: (name: string) => void;
    testID?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      aria-pressed={isFocused}
      onClick={() => onPress(name)}
    >
      {name}
    </button>
  );
  return {
    Tabs: {
      TabBarItem,
      TabBar: ({
        tabNames,
        focusedTab,
        onTabPress,
        renderItem,
      }: {
        tabNames: string[];
        focusedTab: { value: string };
        onTabPress: (name: string) => void;
        renderItem: (
          props: {
            name: string;
            isFocused: boolean;
            onPress: (name: string) => void;
          },
          index: number,
        ) => ReactNode;
      }) => (
        <div>
          {tabNames.map((name, index) => (
            <span key={name}>
              {renderItem(
                {
                  name,
                  isFocused: focusedTab.value === name,
                  onPress: onTabPress,
                },
                index,
              )}
            </span>
          ))}
        </div>
      ),
    },
  };
});

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'tokens', label: 'Tokens' },
] as const;

describe('SelectorTabBar', () => {
  beforeEach(() => {
    mockSharedValues.length = 0;
  });

  it('labels each tab and keys its test id by tab id', () => {
    render(
      <SelectorTabBar
        tabs={[...TABS]}
        value="stocks"
        onChange={jest.fn()}
        testIDPrefix="tab-"
      />,
    );
    expect(screen.getByTestId('tab-all').textContent).toBe('All');
    expect(screen.getByTestId('tab-tokens').textContent).toBe('Tokens');
    expect(screen.getByTestId('tab-stocks').getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('reports the pressed tab by id', () => {
    const onChange = jest.fn();
    render(
      <SelectorTabBar
        tabs={[...TABS]}
        value="all"
        onChange={onChange}
        testIDPrefix="tab-"
      />,
    );
    fireEvent.click(screen.getByTestId('tab-tokens'));
    expect(onChange).toHaveBeenCalledWith('tokens');
  });

  it('moves the focused label when the value changes', () => {
    const { rerender } = render(
      <SelectorTabBar
        tabs={[...TABS]}
        value="all"
        onChange={jest.fn()}
        testIDPrefix="tab-"
      />,
    );
    rerender(
      <SelectorTabBar
        tabs={[...TABS]}
        value="tokens"
        onChange={jest.fn()}
        testIDPrefix="tab-"
      />,
    );
    expect(mockSharedValues[0]?.value).toBe('Tokens');
  });
});
