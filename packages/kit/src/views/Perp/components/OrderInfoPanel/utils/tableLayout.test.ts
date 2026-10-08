import {
  PERP_DESKTOP_TABLE_ROW_HORIZONTAL_PADDING,
  PERP_DESKTOP_TABLE_ROW_PADDING_LEFT,
  PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT,
  getPerpDesktopTableFixedSectionWidth,
} from './tableLayout';

describe('Perp desktop table layout', () => {
  it('uses the same horizontal padding for table headers and rows', () => {
    expect(PERP_DESKTOP_TABLE_ROW_PADDING_LEFT).toBe(20);
    expect(PERP_DESKTOP_TABLE_ROW_PADDING_RIGHT).toBe(12);
    expect(PERP_DESKTOP_TABLE_ROW_HORIZONTAL_PADDING).toBe(32);
  });

  it('includes row padding in the fixed section width', () => {
    expect(getPerpDesktopTableFixedSectionWidth(160)).toBe(192);
    expect(getPerpDesktopTableFixedSectionWidth(80)).toBe(112);
  });
});
