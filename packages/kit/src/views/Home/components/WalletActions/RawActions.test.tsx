/** @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';

import { ActionItem } from './RawActions';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  // Model Tamagui: a `disabled` element never fires its press handler. Both the
  // mobile card and the desktop pill render as buttons so a jsdom `disabled`
  // attribute blocks the click exactly like Tamagui skipping event attachment.
  const makePressable = (kind: string) => {
    function Pressable({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) {
      return onPress ? (
        <button
          type="button"
          data-kind={kind}
          data-testid={testID}
          disabled={disabled}
          onClick={onPress}
        >
          {children}
        </button>
      ) : (
        <div>{children}</div>
      );
    }
    Pressable.displayName = `Pressable(${kind})`;
    return Pressable;
  };
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );

  return {
    ActionList: { Item: Passthrough },
    Button: makePressable('button'),
    Icon: () => null,
    IconButton: makePressable('icon-button'),
    SizableText: Passthrough,
    Stack: makePressable('stack'),
    XStack: Passthrough,
  };
});

function getByKind(container: HTMLElement, kind: string) {
  const el = container.querySelector<HTMLButtonElement>(
    `[data-kind="${kind}"]`,
  );
  expect(el).not.toBeNull();
  return el as HTMLButtonElement;
}

describe('ActionItem disabled state', () => {
  it('blocks presses on the mobile card and the desktop pill', () => {
    const onPress = jest.fn();
    const { container } = render(
      <ActionItem disabled onPress={onPress} label="Receive" />,
    );

    const card = getByKind(container, 'stack');
    const pill = getByKind(container, 'button');
    expect(card.disabled).toBe(true);
    expect(pill.disabled).toBe(true);

    fireEvent.click(card);
    fireEvent.click(pill);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps presses when allowPressWhenDisabled is set', () => {
    const onPress = jest.fn();
    const { container } = render(
      <ActionItem
        disabled
        allowPressWhenDisabled
        onPress={onPress}
        label="Receive"
      />,
    );

    fireEvent.click(getByKind(container, 'stack'));
    fireEvent.click(getByKind(container, 'button'));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('fires presses when enabled', () => {
    const onPress = jest.fn();
    const { container } = render(
      <ActionItem onPress={onPress} label="Receive" />,
    );

    fireEvent.click(getByKind(container, 'stack'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
