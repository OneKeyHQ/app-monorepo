import { IconButton } from '@onekeyhq/components';

import {
  TRADES_HISTORY_SHARE_ACTION_WIDTH,
  TradesHistoryShareAction,
} from './TradesHistoryShareAction';

describe('TradesHistoryShareAction', () => {
  it('keeps a visible direct IconButton in a stable action slot', () => {
    const onPress = jest.fn();
    const action = TradesHistoryShareAction({ visible: true, onPress });
    const button = action.props.children;

    expect(action.props.width).toBe(TRADES_HISTORY_SHARE_ACTION_WIDTH);
    expect(button.type).toBe(IconButton);
    expect(button.props).toMatchObject({
      icon: 'ShareOutline',
      iconSize: '$4',
      size: 'medium',
      variant: 'tertiary',
      onPress,
    });
    expect(button.props.iconProps).toEqual({ color: '$iconSubdued' });
  });

  it('preserves the action slot when sharing is unavailable', () => {
    const action = TradesHistoryShareAction({
      visible: false,
      onPress: jest.fn(),
    });

    expect(action.props.width).toBe(TRADES_HISTORY_SHARE_ACTION_WIDTH);
    expect(action.props.children).toBeNull();
  });
});
