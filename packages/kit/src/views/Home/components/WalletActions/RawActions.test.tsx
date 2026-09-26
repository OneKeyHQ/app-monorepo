/** @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';

import { ActionItem, ActionsPlaceholder } from './RawActions';

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
        <div data-testid={testID}>{children}</div>
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
    Skeleton: ({ testID }: { testID?: string }) => (
      <span data-kind="skeleton" data-testid={testID} />
    ),
    Stack: makePressable('stack'),
    XStack: makePressable('xstack'),
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

// While the balance state is still unknown the header used to render nothing
// where the action row belongs (Slack 09-22: empty account under All Networks
// showed a blank band for the whole fan-out). The placeholder keeps one
// skeleton card per action slot so the band reads as loading instead.
describe('ActionsPlaceholder', () => {
  it('renders one skeleton card per action slot', () => {
    const { container } = render(
      <ActionsPlaceholder slotCount={4} testID="home-wallet-actions-loading" />,
    );

    expect(
      container.querySelector('[data-testid="home-wallet-actions-loading"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(
        '[data-testid="home-wallet-actions-loading-slot"]',
      ),
    ).toHaveLength(4);
    expect(
      container.querySelectorAll('[data-kind="skeleton"]').length,
    ).toBeGreaterThanOrEqual(4);
  });
});
