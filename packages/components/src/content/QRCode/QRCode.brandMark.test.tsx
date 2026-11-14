/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { QRCode } from '.';

import { render } from '@testing-library/react';

import {
  QR_CODE_BRAND_MARK,
  generateMatrix,
  getQRCodeDotCells,
  getQRCodeDotsPath,
  getQRCodeLogoClearArenaSize,
} from './QRCode.utils';

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  TamaguiTheme: ({ children }: { children?: ReactNode }) => children,
  getTokenValue: (token: string) =>
    token === '$textLight' ? '#000000' : '#FFFFFF',
}));

jest.mock('../../primitives/Icon', () => ({ Icon: () => null }));

// The library's web build does not load under jest; plain svg elements carry
// the same props, which is all these tests read.
jest.mock('react-native-svg', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const element = (tag: string) => {
    function SvgElement({ children, ...props }: { children?: ReactNode }) {
      return React.createElement(tag, props, children);
    }
    return SvgElement;
  };
  return {
    __esModule: true,
    default: element('svg'),
    ClipPath: element('clipPath'),
    Defs: element('defs'),
    G: element('g'),
    Image: element('image'),
    Path: element('path'),
    Rect: element('rect'),
  };
});

jest.mock('../../primitives/Stack', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
}));

const VALUE = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';
const SIZE = 176;
const MARK_SIZE = 40;
const MARK_MARGIN = 4;

const dotsPathFor = (clearArenaModules: number) => {
  const matrix = generateMatrix(VALUE, 'H');
  const cellSize = SIZE / matrix.length;
  return getQRCodeDotsPath({
    cells: getQRCodeDotCells({ matrix, clearArenaModules }),
    cellSize,
  });
};

const pathData = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('path')).map((path) =>
    path.getAttribute('d'),
  );

describe('QRCode brand mark', () => {
  it('keeps fractional-size finder rings inside an integer SVG viewport', () => {
    const { container } = render(
      <QRCode value={VALUE} size={190} padding={10} quietZoneModules={2} />,
    );
    const svg = container.querySelector('svg');
    const viewportSize = Number(svg?.getAttribute('width'));
    const [left, top, width, height] = (svg?.getAttribute('viewBox') ?? '')
      .split(' ')
      .map(Number);

    expect(Number.isInteger(viewportSize)).toBe(true);
    expect(width).toBe(viewportSize);
    expect(height).toBe(viewportSize);
    // The plate comes first, followed by the nine nested finder rectangles.
    const rings = Array.from(svg?.querySelectorAll('rect') ?? []).slice(1);
    expect(rings).toHaveLength(9);
    for (const ring of rings) {
      const x = Number(ring.getAttribute('x'));
      const y = Number(ring.getAttribute('y'));
      const ringSize = Number(ring.getAttribute('width'));
      expect(x - left).toBeGreaterThanOrEqual(1);
      expect(y - top).toBeGreaterThanOrEqual(1);
      expect(left + width - x - ringSize).toBeGreaterThanOrEqual(1);
      expect(top + height - y - ringSize).toBeGreaterThanOrEqual(1);
    }
  });

  it('draws the mark on a round plate in the same svg as the code', () => {
    const { container } = render(
      <QRCode
        value={VALUE}
        size={SIZE}
        brandMark
        logoSize={MARK_SIZE}
        logoMargin={MARK_MARGIN}
      />,
    );

    // every shape of the mark, as paths of the code's own svg
    const svg = container.querySelector('svg');
    const marks = QR_CODE_BRAND_MARK.shapes.map((shape) =>
      Array.from(svg?.querySelectorAll('path') ?? []).find(
        (path) => path.getAttribute('d') === shape.d,
      ),
    );
    marks.forEach((mark, index) => {
      expect(mark?.getAttribute('fill')).toBe(
        QR_CODE_BRAND_MARK.shapes[index].fill,
      );
    });
    // scaled so the mark itself, not the icon's padded grid, fills logoSize
    expect(marks[0]?.closest('g[scale]')?.getAttribute('scale')).toBe(
      String(MARK_SIZE / QR_CODE_BRAND_MARK.size),
    );

    // the plate under it: logoSize plus the margin on each side, fully round
    const plateSize = MARK_SIZE + MARK_MARGIN * 2;
    const plate = Array.from(svg?.querySelectorAll('rect') ?? []).find(
      (rect) => rect.getAttribute('width') === String(plateSize),
    );
    expect(plate?.getAttribute('height')).toBe(String(plateSize));
    expect(Number(plate?.getAttribute('rx'))).toBeGreaterThanOrEqual(
      plateSize / 2,
    );
  });

  it('clears the dots under the plate', () => {
    const matrix = generateMatrix(VALUE, 'H');
    const withPlate = dotsPathFor(
      getQRCodeLogoClearArenaSize({
        logoSize: MARK_SIZE,
        logoMargin: MARK_MARGIN,
        cellSize: SIZE / matrix.length,
      }),
    );
    const whole = dotsPathFor(0);
    expect(withPlate).not.toBe(whole);

    const marked = render(
      <QRCode
        value={VALUE}
        size={SIZE}
        brandMark
        logoSize={MARK_SIZE}
        logoMargin={MARK_MARGIN}
      />,
    );
    expect(pathData(marked.container)).toContain(withPlate);

    const bare = render(<QRCode value={VALUE} size={SIZE} />);
    expect(pathData(bare.container)).toContain(whole);
    expect(pathData(bare.container)).not.toContain(
      QR_CODE_BRAND_MARK.shapes[0].d,
    );
  });
});
