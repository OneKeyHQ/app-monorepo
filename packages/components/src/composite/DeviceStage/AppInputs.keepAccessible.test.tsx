/**
 * @jest-environment jsdom
 */

import type React from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PassphraseForm } from './AppInputs';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

// The primitives resolve through shared/tamagui.ts, whose @tamagui/web
// re-export is untransformed ESM under jest (the shared tamagui test mocks
// it the same way). The seed logic lives in PassphraseForm itself, so the
// chrome around it is stood in by bare react-native views that keep the
// two things the test drives: testIDs and presses.
jest.mock('../../primitives', () => {
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  type IBoxProps = { children?: React.ReactNode; testID?: string };
  type IPressProps = IBoxProps & { onPress?: () => void };
  const Box = ({ children, testID }: IBoxProps) => (
    <View testID={testID}>{children}</View>
  );
  const Press = ({ children, testID, onPress }: IPressProps) => (
    <Pressable testID={testID} onPress={onPress}>
      {children}
    </Pressable>
  );
  const Txt = ({ children, testID }: IBoxProps) => (
    <Text testID={testID}>{children}</Text>
  );
  const noop = () => undefined;
  return {
    Anchor: Txt,
    Button: Press,
    Haptics: new Proxy({}, { get: () => noop }),
    Icon: () => null,
    SizableText: Txt,
    Stack: Box,
    XStack: Box,
    YStack: Box,
  };
});

// The Keep-accessible row is its own animated capsule; here it is a
// press that flips the value it was given, which is all the seed needs.
jest.mock('./PreferenceCapsule', () => {
  const { useCallback } = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const PreferenceCapsule = ({
    testID,
    label,
    value,
    onChange,
  }: {
    testID?: string;
    label: string;
    value: boolean;
    onChange: (next: boolean) => void;
  }) => {
    const toggle = useCallback(() => onChange(!value), [onChange, value]);
    return (
      <Pressable testID={testID} onPress={toggle}>
        <Text>{`${label}:${value ? 'on' : 'off'}`}</Text>
      </Pressable>
    );
  };
  return { PreferenceCapsule };
});

// The text field brings in @onekeyfe/react-native-text-input, whose TS
// source is not transformed under jest; the seed never depends on typing,
// so a bare RN TextInput stands in for it.
jest.mock('../../forms/Input', () => {
  const { TextInput } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Input: (props: Record<string, unknown>) => (
      <TextInput accessible {...props} />
    ),
    passwordManagerIgnoreProps: {},
  };
});

// Reanimated (and its own jest mock) pull react-native-worklets, which
// ships untransformed ESM; the form's whole import graph needs only the
// handful of symbols below, all of which are motion — irrelevant to which
// value the switch starts on.
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  const identity = <T,>(value: T): T => value;
  type IChain = { [key: string]: (...args: unknown[]) => IChain };
  const chain: IChain = new Proxy({} as IChain, {
    get: () => () => chain,
  });
  return {
    __esModule: true,
    default: { View: RN.View },
    FadeIn: chain,
    LinearTransition: chain,
    Easing: {
      bezierFn: () => identity,
      linear: identity,
    },
    cancelAnimation: () => undefined,
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => true,
    useSharedValue: <T,>(value: T) => ({ value }),
    withDelay: (_delay: number, value: unknown) => value,
    withRepeat: identity,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withTiming: identity,
  };
});

/** The create form's exits all carry the switch's value; the device
 * switch is the one that needs no typed passphrase to fire. */
type IExitOptions = { keepAccessible: boolean } | undefined;
type IExitMock = jest.Mock<void, [IExitOptions]>;

function exitWith(
  getByTestId: (id: string) => HTMLElement,
  onSwitchToDevice: IExitMock,
): [IExitOptions] {
  fireEvent.click(getByTestId('device-stage-passphrase-switch-on-device'));
  return onSwitchToDevice.mock.calls[onSwitchToDevice.mock.calls.length - 1];
}

describe('PassphraseForm Keep-accessible seed', () => {
  it('starts from the remembered choice, not from a hardcoded ON', () => {
    // A person who turned Keep-accessible off asked for a wallet that does
    // not survive a restart; reopening the form must not quietly turn it
    // back on and persist the wallet on Confirm.
    const onSwitchToDevice: IExitMock = jest.fn();
    const { getByTestId } = render(
      <PassphraseForm
        mode="create"
        initialKeepAccessible={false}
        onSwitchToDevice={onSwitchToDevice}
      />,
    );

    expect(exitWith(getByTestId, onSwitchToDevice)).toEqual([
      { keepAccessible: false },
    ]);
  });

  it('samples the seed on activation and ignores it while the form is up', () => {
    const onSwitchToDevice: IExitMock = jest.fn();
    const { getByTestId, rerender } = render(
      <PassphraseForm
        mode="create"
        initialKeepAccessible={false}
        resetSignal={0}
        onSwitchToDevice={onSwitchToDevice}
      />,
    );

    // A background settings sync arriving mid-entry must not move the
    // switch under the person's hand.
    rerender(
      <PassphraseForm
        mode="create"
        initialKeepAccessible
        resetSignal={0}
        onSwitchToDevice={onSwitchToDevice}
      />,
    );
    expect(exitWith(getByTestId, onSwitchToDevice)).toEqual([
      { keepAccessible: false },
    ]);

    // A fresh activation reads whatever the preference is then.
    rerender(
      <PassphraseForm
        mode="create"
        initialKeepAccessible
        resetSignal={1}
        onSwitchToDevice={onSwitchToDevice}
      />,
    );
    expect(exitWith(getByTestId, onSwitchToDevice)).toEqual([
      { keepAccessible: true },
    ]);
  });

  it('keeps ON as the first-run default when no choice is remembered', () => {
    const onSwitchToDevice: IExitMock = jest.fn();
    const { getByTestId } = render(
      <PassphraseForm mode="create" onSwitchToDevice={onSwitchToDevice} />,
    );

    expect(exitWith(getByTestId, onSwitchToDevice)).toEqual([
      { keepAccessible: true },
    ]);
  });
});
