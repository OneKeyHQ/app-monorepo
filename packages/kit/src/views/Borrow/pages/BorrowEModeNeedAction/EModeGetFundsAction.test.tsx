/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const buttonProps: Record<string, unknown>[] = [];
  (globalThis as Record<string, unknown>).__eModeGetFundsButtonProps =
    buttonProps;

  // A bare host tag, so react-test-renderer keeps the props verbatim and the
  // rendered tree shows exactly what wraps the button.
  function MockButton(props: Record<string, unknown>) {
    buttonProps.push(props);
    return React.createElement(
      'mock-button',
      { testID: props.testID as string },
      props.children as string,
    );
  }

  return { Button: MockButton };
});

import { render } from '@testing-library/react-native';

import { BorrowTestIDs } from '../../testIDs';

import { EModeGetFundsAction } from './EModeGetFundsAction';

const buttonProps = (globalThis as Record<string, unknown>)
  .__eModeGetFundsButtonProps as Record<string, unknown>[];

describe('EModeGetFundsAction', () => {
  beforeEach(() => {
    buttonProps.length = 0;
  });

  it('names the token it will swap into', () => {
    render(<EModeGetFundsAction symbol="USDT" onPress={jest.fn()} />);

    expect(buttonProps[0].children).toBe('global.swap USDT');
  });

  // Aave's native reserves carry no symbol.
  it('drops the trailing space when the reserve has no symbol', () => {
    render(<EModeGetFundsAction symbol="" onPress={jest.fn()} />);

    expect(buttonProps[0].children).toBe('global.swap');
  });

  it('is the footer primary and shares the row', () => {
    render(<EModeGetFundsAction symbol="USDT" onPress={jest.fn()} />);
    const props = buttonProps[0];

    expect(props.testID).toBe(BorrowTestIDs.eModeNeedActionGetFundsBtn);
    // The one live control on a screen whose confirm is disabled.
    expect(props.variant).toBe('primary');
    expect(props.flexGrow).toBe(1);
    expect(props.flexShrink).toBe(1);
    expect(props.textEllipsis).toBe(true);
  });

  // The flex props above only reach the footer row if the button is its direct
  // child. An ActionList wrapper used to sit here and sized itself to its
  // content, so the button never grew and the row came out lopsided.
  it('puts the button at the root with nothing wrapping it', () => {
    const tree = render(
      <EModeGetFundsAction symbol="USDT" onPress={jest.fn()} />,
    ).toJSON() as { props?: Record<string, unknown>; type?: string } | null;

    expect(Array.isArray(tree)).toBe(false);
    expect(tree?.type).toBe('mock-button');
    expect(tree?.props?.testID).toBe(BorrowTestIDs.eModeNeedActionGetFundsBtn);
  });

  it('swaps on press instead of opening a picker', () => {
    const onPress = jest.fn();
    render(<EModeGetFundsAction symbol="USDT" onPress={onPress} />);

    (buttonProps[0].onPress as () => void)();

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
