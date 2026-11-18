/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { SectionList } from '.';

import { fireEvent, render, waitFor } from '@testing-library/react';
import { Text } from 'react-native';

jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native-web'),
);
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  getTokenValue: () => 0,
  withStaticProperties: <T extends object, U extends object>(
    component: T,
    properties: U,
  ) => Object.assign(component, properties),
  usePropsAndStyle: (props: Record<string, unknown>) => [props, props.style],
  useStyle: (style: unknown) => style,
}));
jest.mock('../../primitives', () => {
  const { Text: NativeText, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { SizableText: NativeText, Stack: View, XStack: View };
});
jest.mock('../../utils/DebugRenderTracker', () => ({
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('@shopify/flash-list', () => ({ FlashList: () => null }));

const listStyle = { height: 120 };
const sections = [{ title: 'Networks', data: ['Ethereum', 'Bitcoin'] }];
const dataSet = { 'collapsible-pager-scroll': 'true' };
const renderItem = ({ item }: { item: string }) => <Text>{item}</Text>;
const renderSectionHeader = ({ section }: { section: { title?: string } }) => (
  <Text>{section.title}</Text>
);

it('forwards the pager marker to the actual Web scroll owner', async () => {
  const onScroll = jest.fn();
  const { container } = render(
    <SectionList
      style={listStyle}
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      dataSet={dataSet}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />,
  );
  const scrollOwner = container.querySelector<HTMLElement>(
    '[data-collapsible-pager-scroll="true"]',
  );
  expect(scrollOwner).not.toBeNull();
  expect(getComputedStyle(scrollOwner!).overflowY).toBe('auto');
  fireEvent.scroll(scrollOwner!, { target: { scrollTop: 40 } });
  await waitFor(() => expect(onScroll).toHaveBeenCalled());
});
