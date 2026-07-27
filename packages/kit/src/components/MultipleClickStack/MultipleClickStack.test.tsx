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

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: true }],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
  },
}));

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
