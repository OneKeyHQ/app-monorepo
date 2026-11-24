/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { createIntl } from 'react-intl';
const intl = createIntl({ locale: 'en', onError: () => {} });
let content: ReactNode;
let pressKey: (key: string) => void;
const close = jest.fn();
const Box = ({
  children,
  testID,
  onPress,
  disabled,
}: PropsWithChildren<{
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
}>) =>
  onPress ? (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ) : (
    <div data-testid={testID}>{children}</div>
  );
const mocks = {
  'react-intl': { useIntl: () => intl },
  '@onekeyhq/components': {
    Button: Box,
    Input: Box,
    SizableText: Box,
    XStack: Box,
    YStack: Box,
    useDialogInstance: () => ({ close }),
    Dialog: {
      show: ({ renderContent }: { renderContent: ReactNode }) => {
        content = renderContent;
        return { close };
      },
    },
  },
  '@onekeyhq/shared/src/platformEnv': {
    __esModule: true,
    default: { isNative: true },
  },
  '@onekeyhq/shared/src/utils/perpsUtils': {
    formatHlPrice: (value: string) => (Number(value) > 0 ? value : ''),
  },
  '../PerpsNativeAmountKeypad': {
    PerpsNativeAmountKeypad: ({
      onKeyPress,
    }: {
      onKeyPress: (key: string) => void;
    }) => {
      pressKey = onKeyPress;
      return null;
    },
  },
};
Object.entries(mocks).forEach(([path, mock]) => jest.doMock(path, () => mock));
const { showSimpleOrderTypeDialog } = jest.requireActual<
  typeof import('./SimpleOrderTypeDialog')
>('./SimpleOrderTypeDialog');
it.each([
  ['1', '2', '10012'],
  ['backspace', 'backspace', '1'],
  ['.', '2', '100.2'],
])('retains batched native keypad events %s %s', (first, second, expected) => {
  const onConfirm = jest.fn();
  showSimpleOrderTypeDialog(
    {
      value: { type: 'limit', price: '100' },
      side: 'long',
      marketPrice: '100',
      getMarketPrice: () => '100',
      szDecimals: 2,
      onConfirm,
    },
    intl,
  );
  const { getByTestId } = render(<>{content}</>);
  act(() => {
    pressKey(first);
    pressKey(second);
  });
  fireEvent.click(getByTestId('perps-simple-order-type-confirm'));
  expect(onConfirm).toHaveBeenCalledWith({ type: 'limit', price: expected });
});
