import {
  AVATAR_ROW_HEIGHT,
  getAvatarGridHeight,
} from './walletAvatarGridLayout';

describe('getAvatarGridHeight', () => {
  it('shows every row when the window is tall enough', () => {
    expect(getAvatarGridHeight({ avatarCount: 36, windowHeight: 768 })).toBe(
      360,
    );
  });

  it('fits the grid into a short window so the footer stays visible', () => {
    expect(
      getAvatarGridHeight({ avatarCount: 36, windowHeight: 520 }),
    ).toBeCloseTo(288);
    expect(
      getAvatarGridHeight({ avatarCount: 36, windowHeight: 420 }),
    ).toBeCloseTo(198);
  });

  it('keeps at least two rows in a very short window', () => {
    expect(getAvatarGridHeight({ avatarCount: 36, windowHeight: 200 })).toBe(
      AVATAR_ROW_HEIGHT * 2,
    );
  });

  it('counts a partial last row as a full row', () => {
    expect(getAvatarGridHeight({ avatarCount: 13, windowHeight: 768 })).toBe(
      AVATAR_ROW_HEIGHT * 3,
    );
  });
});
