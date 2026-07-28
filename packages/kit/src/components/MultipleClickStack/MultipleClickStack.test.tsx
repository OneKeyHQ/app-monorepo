/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MultipleClickStack } from './MultipleClickStack';

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onPress,
    testID,
  }: {
    children: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
}));

const mockDevSettings = { enabled: true };

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [mockDevSettings],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
  },
}));

beforeEach(() => {
  mockDevSettings.enabled = true;
});

describe.each([3, 10])(
  'MultipleClickStack with triggerAt=$triggerAt',
  (triggerAt) => {
    it(`triggers on click ${triggerAt}`, () => {
      const onPress = jest.fn();

      render(
        <MultipleClickStack
          testID="multiple-click-target"
          triggerAt={triggerAt}
          onPress={onPress}
          debugComponent={<span>Debug component</span>}
        >
          Target
        </MultipleClickStack>,
      );

      const target = screen.getByTestId('multiple-click-target');
      for (let clickIndex = 1; clickIndex < triggerAt; clickIndex += 1) {
        fireEvent.click(target);
      }

      expect(onPress).not.toHaveBeenCalled();
      expect(screen.queryByText('Debug component')).toBeNull();

      fireEvent.click(target);

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Debug component')).not.toBeNull();
    });
  },
);

// debugComponent is the only devSettings-gated way to reveal something behind
// the multi-click. Callers that must not expose an entry to ordinary users have
// to use it instead of onPress, which fires regardless of developer mode.
describe('MultipleClickStack with developer mode disabled', () => {
  it('keeps debugComponent hidden past the click threshold', () => {
    mockDevSettings.enabled = false;
    const onPress = jest.fn();

    render(
      <MultipleClickStack
        testID="multiple-click-target"
        triggerAt={3}
        onPress={onPress}
        debugComponent={<span>Debug component</span>}
      >
        Target
      </MultipleClickStack>,
    );

    const target = screen.getByTestId('multiple-click-target');
    for (let clickIndex = 0; clickIndex < 5; clickIndex += 1) {
      fireEvent.click(target);
    }

    expect(screen.queryByText('Debug component')).toBeNull();
    // onPress is intentionally not gated on developer mode.
    expect(onPress).toHaveBeenCalled();
  });
});
