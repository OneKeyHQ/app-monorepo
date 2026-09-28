import { KEYBOARD_MARGIN, computeKeyboardShift } from '../web/useKeyboardShift';

describe('computeKeyboardShift', () => {
  it('does not move without a keyboard', () => {
    expect(
      computeKeyboardShift({
        keyboardTop: undefined,
        contentTop: 300,
        contentBottom: 500,
        isSheet: false,
      }),
    ).toBe(0);
  });

  it('lifts centered content until it clears the keyboard by the margin', () => {
    expect(
      computeKeyboardShift({
        keyboardTop: 450,
        contentTop: 300,
        contentBottom: 500,
        isSheet: false,
      }),
    ).toBe(50 + KEYBOARD_MARGIN);
  });

  it('leaves content that already clears the keyboard alone', () => {
    expect(
      computeKeyboardShift({
        keyboardTop: 600,
        contentTop: 300,
        contentBottom: 500,
        isSheet: false,
      }),
    ).toBe(0);
  });

  it('lifts a sheet by the covered part without a margin', () => {
    expect(
      computeKeyboardShift({
        keyboardTop: 500,
        contentTop: 600,
        contentBottom: 844,
        isSheet: true,
      }),
    ).toBe(344);
  });

  it('never lifts above the top safe area', () => {
    expect(
      computeKeyboardShift({
        keyboardTop: 400,
        contentTop: 100,
        contentBottom: 800,
        isSheet: true,
        safeTop: 60,
      }),
    ).toBe(40);
  });

  it('never moves full-window content', () => {
    expect(
      computeKeyboardShift({
        keyboardTop: 400,
        contentTop: 0,
        contentBottom: 844,
        isSheet: false,
        safeTop: 47,
      }),
    ).toBe(0);
  });
});
