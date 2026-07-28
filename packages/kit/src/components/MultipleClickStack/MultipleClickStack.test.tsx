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

describe('MultipleClickStack with developer mode disabled', () => {
  beforeEach(() => {
    mockDevSettings.enabled = false;
  });

  function renderTarget(props: { devSettingsOnly?: boolean }) {
    const onPress = jest.fn();
    render(
      <MultipleClickStack
        testID="multiple-click-target"
        triggerAt={3}
        onPress={onPress}
        debugComponent={<span>Debug component</span>}
        {...props}
      >
        Target
      </MultipleClickStack>,
    );
    const target = screen.getByTestId('multiple-click-target');
    for (let clickIndex = 0; clickIndex < 5; clickIndex += 1) {
      fireEvent.click(target);
    }
    return { onPress };
  }

  // debugComponent has always been gated on developer mode, onPress never was,
  // so an entry that relies on onPress alone stays reachable by any user.
  it('keeps debugComponent hidden but still fires onPress by default', () => {
    const { onPress } = renderTarget({});

    expect(screen.queryByText('Debug component')).toBeNull();
    expect(onPress).toHaveBeenCalled();
  });

  // devSettingsOnly is what a caller opts into to gate the whole trigger,
  // so a hidden entry cannot be found by tapping around a production build.
  it('suppresses the whole trigger with devSettingsOnly', () => {
    const { onPress } = renderTarget({ devSettingsOnly: true });

    expect(screen.queryByText('Debug component')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('MultipleClickStack with devSettingsOnly and developer mode enabled', () => {
  it('triggers once the click threshold is reached', () => {
    const onPress = jest.fn();

    render(
      <MultipleClickStack
        testID="multiple-click-target"
        triggerAt={3}
        devSettingsOnly
        onPress={onPress}
        debugComponent={<span>Debug component</span>}
      >
        Target
      </MultipleClickStack>,
    );

    const target = screen.getByTestId('multiple-click-target');
    fireEvent.click(target);
    fireEvent.click(target);

    expect(onPress).not.toHaveBeenCalled();

    fireEvent.click(target);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Debug component')).not.toBeNull();
  });
});
