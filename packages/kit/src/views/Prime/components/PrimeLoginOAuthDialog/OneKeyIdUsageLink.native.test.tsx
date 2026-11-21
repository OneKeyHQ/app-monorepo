/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { OneKeyIdUsageLink } from './OneKeyIdUsageLink.native';

// Stands in for React Native's Text: a screen reader's activation of the link
// span reaches only the `onPress` the Text itself receives.
jest.mock('react-native', () => ({
  Text: ({
    children,
    onPress,
    accessibilityRole,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityRole?: string;
    testID?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      data-role={accessibilityRole}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));

it('hands the press handler and link role to the native Text', () => {
  const onPress = jest.fn();
  render(
    <OneKeyIdUsageLink
      onPress={onPress}
      onElementChange={jest.fn()}
      expanded={false}
      controlsId="usage"
    >
      Learn more
    </OneKeyIdUsageLink>,
  );
  const link = screen.getByTestId('prime-login-usage-link');
  expect(link.dataset.role).toBe('link');
  fireEvent.click(link);
  expect(onPress).toHaveBeenCalledTimes(1);
});
