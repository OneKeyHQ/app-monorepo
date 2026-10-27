import type { ReactNode } from 'react';

import { ListItem } from '.';

import { act, render } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { OverlayCloseCancelledError } from '@onekeyhq/components/src/shared/overlayCloseCancellation';

let mockItemPress: (() => Promise<void>) | undefined;
let mockNativePress: (() => Promise<void>) | undefined;
let mockIsNative = false;

jest.mock('react-native', () => ({
  ...(jest.requireActual('react-native-web') as Record<string, unknown>),
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress: () => Promise<void>;
  }) => {
    mockNativePress = onPress;
    return <>{children}</>;
  },
}));

jest.mock('@onekeyhq/components', () => {
  const { OverlayCloseCancelledError: ActualOverlayCloseCancelledError } =
    jest.requireActual<
      typeof import('../../../../components/src/shared/overlayCloseCancellation')
    >('../../../../components/src/shared/overlayCloseCancellation');
  const Primitive = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const Stack = ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => Promise<void>;
  }) => {
    if (onPress) mockItemPress = onPress;
    return <>{children}</>;
  };
  Stack.styleable = (component: unknown) => component;
  return {
    Divider: Primitive,
    Icon: Primitive,
    IconButton: Primitive,
    Image: Object.assign(Primitive, { Fallback: Primitive }),
    MatchSizeableText: Primitive,
    SizableText: Primitive,
    Spinner: Primitive,
    Stack,
    Unspaced: Primitive,
    OverlayCloseCancelledError: ActualOverlayCloseCancelledError,
    withStaticProperties: (component: unknown) => component,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));
jest.mock('../AccountAvatar', () => ({ AccountAvatar: () => null }));
jest.mock('../../hooks/useStatefulAction', () => ({
  useStatefulAction: jest.fn(),
}));

describe('ListItem overlay close cancellation', () => {
  beforeEach(() => {
    mockItemPress = undefined;
    mockNativePress = undefined;
    mockIsNative = false;
  });

  it('settles a canceled row press without running its follow-up', async () => {
    const followUp = jest.fn();
    render(
      <ListItem
        onPress={async () => {
          await Promise.reject(new OverlayCloseCancelledError('reopened'));
          followUp();
        }}
      />,
    );

    await act(async () => {
      await expect(mockItemPress?.()).resolves.toBeUndefined();
    });
    expect(followUp).not.toHaveBeenCalled();
  });

  it('preserves successful presses and ordinary rejection identity', async () => {
    const followUp = jest.fn();
    const error = new Error('action failed');
    const { rerender } = render(<ListItem onPress={followUp} />);

    await act(async () => {
      await mockItemPress?.();
    });
    expect(followUp).toHaveBeenCalledTimes(1);

    rerender(<ListItem onPress={async () => Promise.reject(error)} />);
    await act(async () => {
      await expect(mockItemPress?.()).rejects.toBe(error);
    });
  });

  it('settles a canceled native Pressable press', async () => {
    mockIsNative = true;
    const followUp = jest.fn();
    const view = render(
      <ListItem
        onPress={async () => {
          await Promise.reject(new OverlayCloseCancelledError('reopened'));
          followUp();
        }}
      />,
    );
    const press = view.UNSAFE_getByType(Pressable).props
      .onPress as () => Promise<void>;
    expect(mockNativePress).toBe(press);

    await act(async () => {
      await expect(press()).resolves.toBeUndefined();
    });
    expect(followUp).not.toHaveBeenCalled();
  });
});
