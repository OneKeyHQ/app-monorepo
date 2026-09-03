/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { symbol?: string }) =>
      values?.symbol ? `${id}:${values.symbol}` : id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text, View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  const renderActionList = jest.fn(
    (props: { renderTrigger: import('react').ReactNode }) =>
      React.createElement(
        View,
        { testID: 'mock-action-list' },
        props.renderTrigger,
      ),
  );
  const showActionList = jest.fn();
  const ActionList = Object.assign(renderActionList, {
    show: showActionList,
  });
  (globalThis as Record<string, unknown>).__eModeGetFundsActionListMock = {
    renderActionList,
    showActionList,
  };

  return {
    ActionList,
    Button: Text,
  };
});

import type { ReactElement } from 'react';

import { render } from '@testing-library/react-native';

import type { IActionListItemProps } from '@onekeyhq/components';

import { BorrowTestIDs } from '../../testIDs';

import { EModeGetFundsAction } from './EModeGetFundsAction';

const actionListMocks = (globalThis as Record<string, unknown>)
  .__eModeGetFundsActionListMock as {
  renderActionList: jest.Mock;
  showActionList: jest.Mock;
};

type ITriggerProps = {
  children: string;
  iconAfter: string;
  onPress: () => void;
  testID: string;
  variant: string;
};

function renderAction(onPress: () => void) {
  const items: IActionListItemProps[] = [
    { label: 'Swap', icon: 'SwitchHorOutline' },
    { label: 'Receive', icon: 'ArrowBottomOutline' },
  ];

  render(<EModeGetFundsAction symbol="USDT" items={items} onPress={onPress} />);

  return {
    items,
    props: actionListMocks.renderActionList.mock.calls[0]?.[0] as {
      items: IActionListItemProps[];
      placement: string;
      renderTrigger: ReactElement<ITriggerProps>;
      title: string;
    },
  };
}

describe('EModeGetFundsAction', () => {
  beforeEach(() => {
    actionListMocks.renderActionList.mockClear();
    actionListMocks.showActionList.mockClear();
  });

  it('uses a button as a declarative ActionList trigger', () => {
    const onPress = jest.fn();
    const { items, props } = renderAction(onPress);

    expect(actionListMocks.renderActionList).toHaveBeenCalledTimes(1);
    expect(props).toEqual(
      expect.objectContaining({
        items,
        placement: 'bottom-end',
        renderTrigger: expect.anything(),
        // The sheet keeps the symbol; only the button drops it.
        title: 'defi_emode_get_symbol__action:USDT',
      }),
    );
    expect(props.renderTrigger.props.testID).toBe(
      BorrowTestIDs.eModeNeedActionGetFundsBtn,
    );
    expect(props.renderTrigger.props.variant).toBe('secondary');
    expect(actionListMocks.showActionList).not.toHaveBeenCalled();

    props.renderTrigger.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('labels the button without the token symbol, and marks it expandable', () => {
    const { props } = renderAction(jest.fn());

    expect(props.renderTrigger.props.children).toBe('global.top_up');
    expect(props.renderTrigger.props.children).not.toContain('USDT');
    expect(props.renderTrigger.props.iconAfter).toBe('ChevronDownSmallOutline');
  });
});
