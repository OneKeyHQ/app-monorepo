/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IOverlayWidthClass } from '@onekeyhq/components/src/hooks/useOverlayWidthClass';

let mockWidthClass: IOverlayWidthClass = 'compact';

// Jest maps every `@onekeyhq/components*` import to one module (see
// moduleNameMapper), so the deep-imported hook is mocked alongside the
// components.
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const box = ({
    children,
    testID,
    pt,
    px,
    pb,
    gap,
  }: {
    children?: ReactNode;
    testID?: string;
    pt?: string;
    px?: string;
    pb?: string;
    gap?: string;
  }) =>
    createElement(
      'div',
      {
        'data-testid': testID,
        'data-pt': pt,
        'data-px': px,
        'data-pb': pb,
        'data-gap': gap,
      },
      children,
    );
  return {
    SizableText: box,
    XStack: box,
    YStack: box,
    useOverlayWidthClass: () => mockWidthClass,
  };
});

// DetailRow also hosts the animated row wrapper; its motion setup needs the
// native worklets runtime, which jest does not load.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'div' },
}));
jest.mock('./motionTokens', () => ({}));

import { InfoPopoverContent } from './DetailRow';

describe('InfoPopoverContent', () => {
  // OK-66874: the sheet header already pads the space under its title, so a
  // body with its own top padding doubled the gap.
  it.each<IOverlayWidthClass>(['compact', 'medium'])(
    'adds no top padding under the sheet header (%s window)',
    (widthClass) => {
      mockWidthClass = widthClass;
      render(<InfoPopoverContent testID="content">body</InfoPopoverContent>);

      const content = screen.getByTestId('content');
      expect(content.getAttribute('data-pt')).toBe('$0');
      expect(content.getAttribute('data-px')).toBe('$5');
      expect(content.getAttribute('data-pb')).toBe('$5');
    },
  );

  it('keeps the top padding in the anchored panel, which has no header', () => {
    mockWidthClass = 'expanded';
    render(<InfoPopoverContent testID="content">body</InfoPopoverContent>);

    expect(screen.getByTestId('content').getAttribute('data-pt')).toBe('$5');
  });

  it('passes layout props such as gap through', () => {
    mockWidthClass = 'compact';
    render(
      <InfoPopoverContent testID="content" gap="$3">
        body
      </InfoPopoverContent>,
    );

    expect(screen.getByTestId('content').getAttribute('data-gap')).toBe('$3');
  });
});
