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
    SizableText: Text,
    XStack: View,
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

describe('EModeGetFundsAction', () => {
  beforeEach(() => {
    actionListMocks.renderActionList.mockClear();
    actionListMocks.showActionList.mockClear();
  });

  it('uses the link as a declarative ActionList trigger', () => {
    const onPress = jest.fn();
    const items: IActionListItemProps[] = [
      { label: 'Swap', icon: 'SwitchHorOutline' },
      { label: 'Receive', icon: 'ArrowBottomOutline' },
    ];

    render(
      <EModeGetFundsAction symbol="USDT" items={items} onPress={onPress} />,
    );

    expect(actionListMocks.renderActionList).toHaveBeenCalledTimes(1);
    const actionListProps = actionListMocks.renderActionList.mock
      .calls[0]?.[0] as {
      items: IActionListItemProps[];
      placement: string;
      renderTrigger: ReactElement<{
        onPress: () => void;
        testID: string;
      }>;
      title: string;
    };
    expect(actionListProps).toEqual(
      expect.objectContaining({
        items,
        placement: 'bottom-start',
        renderTrigger: expect.anything(),
        title: 'defi_emode_get_symbol__action:USDT',
      }),
    );
    expect(actionListProps.renderTrigger.props.testID).toBe(
      BorrowTestIDs.eModeNeedActionGetFundsBtn,
    );
    expect(actionListMocks.showActionList).not.toHaveBeenCalled();

    actionListProps.renderTrigger.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
