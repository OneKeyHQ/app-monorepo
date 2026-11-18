/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ProtocolIntroSection } from './ProtocolIntroSection';

let mockLayoutHeight = 60;
let mockLayoutWidth = 700;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: () => null,
  Path: () => null,
}));

jest.mock('@onekeyhq/components', () => {
  type IBoxProps = {
    children?: ReactNode;
    onPress?: () => void;
    onLayout?: (event: {
      nativeEvent: { layout: { width: number; height: number } };
    }) => void;
    lineHeight?: number;
    numberOfLines?: number;
    minHeight?: number;
  };
  const Box = ({ children, onPress, onLayout, minHeight }: IBoxProps) => {
    const activate = onLayout
      ? () =>
          onLayout({
            nativeEvent: {
              layout: { width: mockLayoutWidth, height: mockLayoutHeight },
            },
          })
      : onPress;
    return (
      <div
        data-testid={onLayout ? 'measurement' : undefined}
        data-min-height={minHeight}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter') activate?.();
        }}
      >
        {children}
      </div>
    );
  };
  const Text = ({
    children,
    onPress,
    lineHeight,
    numberOfLines,
  }: IBoxProps) => (
    <span
      data-description={lineHeight === 20 ? 'true' : undefined}
      data-lines={numberOfLines}
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onPress?.();
      }}
    >
      {children}
    </span>
  );
  const Image = Object.assign(() => null, {
    preloadImages: jest.fn().mockResolvedValue(undefined),
  });
  return {
    Accordion: { Item: Box, Trigger: Box, Content: Box, HeightAnimator: Box },
    Button: Box,
    Dialog: { show: jest.fn() },
    Divider: () => null,
    Icon: () => null,
    Image,
    SizableText: Text,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    s: (value: number) => value,
    ANIMATE_ONLY_OPACITY: [],
    ANIMATE_ONLY_TRANSFORM: [],
    useDialogInstance: () => undefined,
    useMedia: () => ({ gtMd: true }),
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnIcon',
  () => ({
    EarnIcon: () => null,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: string | { text?: string } }) => (
      <span>{typeof text === 'string' ? text : text?.text}</span>
    ),
  }),
);
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: { global_more: 'global.more' },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

const longText = `${'Ethena protocol '.repeat(20)}end`;
const shortText = 'Pendle protocol';

function visibleDescription(container: HTMLElement) {
  const descriptions = Array.from(
    container.querySelectorAll<HTMLElement>('[data-description="true"]'),
  );
  return descriptions.find(
    (element) => !element.closest('[data-testid="measurement"]'),
  );
}

beforeEach(() => {
  mockLayoutHeight = 60;
  mockLayoutWidth = 700;
});

it('does not guess truncation while waiting for measurement', () => {
  const { container } = render(
    <ProtocolIntroSection
      protocolInfo={[{ name: 'Ethena', description: longText }]}
    />,
  );
  expect(visibleDescription(container)?.textContent).toBe(longText);
  expect(visibleDescription(container)?.getAttribute('data-lines')).toBe('3');
  expect(screen.queryByText('global.more')).toBeNull();
  fireEvent.click(screen.getByTestId('measurement'));
  expect(visibleDescription(container)?.textContent).toBe(longText);
  expect(screen.queryByText('global.more')).toBeNull();
});

it('offers more for measured overflow and expands the full description', () => {
  mockLayoutHeight = 120;
  const { container } = render(
    <ProtocolIntroSection
      protocolInfo={[{ name: 'Ethena', description: longText }]}
    />,
  );
  fireEvent.click(screen.getByTestId('measurement'));
  expect(screen.getByText('global.more')).toBeTruthy();
  expect(visibleDescription(container)?.getAttribute('data-lines')).toBe('3');
  expect(
    visibleDescription(container)?.parentElement?.getAttribute(
      'data-min-height',
    ),
  ).toBe('60');
  fireEvent.click(screen.getByText('global.more'));
  expect(visibleDescription(container)?.textContent).toBe(longText);
  expect(visibleDescription(container)?.getAttribute('data-lines')).toBeNull();
  expect(
    visibleDescription(container)?.parentElement?.getAttribute(
      'data-min-height',
    ),
  ).toBeNull();
});

it('shows short text without a more action', () => {
  mockLayoutHeight = 20;
  const { container } = render(
    <ProtocolIntroSection
      protocolInfo={[{ name: 'Pendle', description: shortText }]}
    />,
  );
  fireEvent.click(screen.getByTestId('measurement'));
  expect(visibleDescription(container)?.textContent).toBe(shortText);
  expect(
    visibleDescription(container)?.parentElement?.getAttribute(
      'data-min-height',
    ),
  ).toBeNull();
  expect(screen.queryByText('global.more')).toBeNull();
});

it('updates overflow after the available width changes', () => {
  mockLayoutHeight = 120;
  const { container } = render(
    <ProtocolIntroSection
      protocolInfo={[{ name: 'Ethena', description: longText }]}
    />,
  );
  fireEvent.click(screen.getByTestId('measurement'));
  expect(screen.getByText('global.more')).toBeTruthy();
  mockLayoutWidth = 1000;
  mockLayoutHeight = 60;
  fireEvent.click(screen.getByTestId('measurement'));
  expect(visibleDescription(container)?.textContent).toBe(longText);
  expect(screen.queryByText('global.more')).toBeNull();
});

it('resets expansion and remeasures when switching providers', () => {
  mockLayoutHeight = 120;
  const { container } = render(
    <ProtocolIntroSection
      protocolInfo={[
        { name: 'Ethena', description: longText },
        { name: 'Pendle', description: shortText },
      ]}
    />,
  );
  fireEvent.click(screen.getByTestId('measurement'));
  fireEvent.click(screen.getByText('global.more'));
  const oldMeasurement = screen.getByTestId('measurement');
  fireEvent.click(screen.getByText('Pendle'));
  expect(screen.getByTestId('measurement')).not.toBe(oldMeasurement);
  expect(visibleDescription(container)?.textContent).toBe(shortText);
  mockLayoutHeight = 20;
  fireEvent.click(screen.getByTestId('measurement'));
  expect(screen.queryByText('global.more')).toBeNull();
  fireEvent.click(screen.getByText('Ethena'));
  expect(visibleDescription(container)?.textContent).toBe(longText);
  expect(screen.queryByText('global.more')).toBeNull();
  mockLayoutHeight = 120;
  fireEvent.click(screen.getByTestId('measurement'));
  expect(screen.getByText('global.more')).toBeTruthy();
});
