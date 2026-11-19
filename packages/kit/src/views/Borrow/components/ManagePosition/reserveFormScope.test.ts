import { hidesPositionNotHeld } from './reserveFormScope';

describe('hidesPositionNotHeld', () => {
  it('leaves out a position the account does not hold while nothing is typed', () => {
    expect(hidesPositionNotHeld({ holds: false, hasAmount: false })).toBe(true);
  });

  it('shows it once an amount is typed, as what the action makes of it', () => {
    expect(hidesPositionNotHeld({ holds: false, hasAmount: true })).toBe(false);
  });

  it('shows a position the account holds, or one not read yet', () => {
    expect(hidesPositionNotHeld({ holds: true, hasAmount: false })).toBe(false);
    expect(hidesPositionNotHeld({ holds: undefined, hasAmount: false })).toBe(
      false,
    );
  });
});
