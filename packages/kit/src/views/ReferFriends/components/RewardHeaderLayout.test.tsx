/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

interface IPrimitiveProps {
  alignSelf?: string;
  children?: ReactNode;
  width?: string;
  w?: string;
}

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const createPrimitive = (name: string) =>
    function Primitive({ alignSelf, children, width, w }: IPrimitiveProps) {
      return React.createElement(
        'div',
        {
          'data-align-self': alignSelf,
          'data-component': name,
          'data-width': width ?? w,
        },
        children,
      );
    };

  return {
    Stack: createPrimitive('stack'),
    XStack: createPrimitive('x-stack'),
    YStack: createPrimitive('y-stack'),
    useMedia: () => ({ lg: true, md: true }),
  };
});

import { ResponsiveFourColumnLayout } from './RewardHeaderLayout';

describe('ResponsiveFourColumnLayout', () => {
  it('renders narrow columns in an explicitly stretched vertical layout', () => {
    const { container } = render(
      <ResponsiveFourColumnLayout
        firstColumn={<span>One</span>}
        secondColumn={<span>Two</span>}
        thirdColumn={<span>Three</span>}
        fourthColumn={<span>Four</span>}
      />,
    );

    const layout = container.firstElementChild;
    expect(layout?.getAttribute('data-component')).toBe('y-stack');
    expect(layout?.getAttribute('data-align-self')).toBe('stretch');
    expect(layout?.getAttribute('data-width')).toBe('100%');

    expect(layout?.children).toHaveLength(4);
    Array.from(layout?.children ?? []).forEach((column) => {
      expect(column.getAttribute('data-component')).toBe('y-stack');
      expect(column.getAttribute('data-align-self')).toBe('stretch');
      expect(column.getAttribute('data-width')).toBe('100%');
    });
  });
});
