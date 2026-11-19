/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { UnOrderedList } from '.';

import { render, screen } from '@testing-library/react';

jest.mock('../../primitives', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Primitive = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Icon: Primitive,
    SizableText: Primitive,
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
  };
});

jest.mock('../../utils/getFontSize', () => ({
  getFontToken: () => ({ lineHeight: 20 }),
}));

it('ignores empty children while spacing list items', () => {
  render(
    <UnOrderedList>
      {false}
      <UnOrderedList.Item>First rule</UnOrderedList.Item>
      {null}
      <UnOrderedList.Item>Second rule</UnOrderedList.Item>
    </UnOrderedList>,
  );

  expect(screen.getByText('First rule')).toBeTruthy();
  expect(screen.getByText('Second rule')).toBeTruthy();
});
