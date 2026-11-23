import {
  createAmountInputCharacters,
  sanitizeAmountInputText,
  updateAmountInputCharacters,
} from './amountInputTextUtils';

const SANITIZE_CASES: Array<[string, string, string]> = [
  ['empty input', '', ''],
  ['plain integer', '1234', '1234'],
  ['letters inside digits', '1a234g', '1234'],
  ['letters around a leading decimal', 'a.5g', '0.5'],
  ['letters only', 'abc', ''],
  ['negative marker', '-1.2', '1.2'],
  ['spaces inside digits', ' 1 2 . 3 ', '12.3'],
  ['redundant integer zeros', '000123', '123'],
  ['redundant decimal zeros', '000.12', '0.12'],
  ['leading decimal', '.5', '0.5'],
  ['consecutive leading decimals', '..5', '0.5'],
  ['consecutive decimals', '1..23', '1.23'],
  ['multiple separated decimals', '1.2.3', '1.23'],
  ['mixed decimal separators', '1，2。3', '1.23'],
  ['comma-leading decimal', ',5', '0.5'],
];

describe('sanitizeAmountInputText', () => {
  it.each(SANITIZE_CASES)('%s', (_name, input, expected) => {
    expect(sanitizeAmountInputText(input)).toBe(expected);
  });

  it('preserves delete followed by additional digits', () => {
    const nativeValues = [
      '1',
      '12',
      '123',
      '1234',
      '123',
      '1235',
      '12356',
      '123567',
    ];

    expect(nativeValues.map(sanitizeAmountInputText)).toEqual(nativeValues);
  });

  it('collapses repeated decimals throughout a typing sequence', () => {
    const nativeValues = ['1', '1.', '1..', '1..2', '1..23'];

    expect(nativeValues.map(sanitizeAmountInputText)).toEqual([
      '1',
      '1.',
      '1.',
      '1.2',
      '1.23',
    ]);
  });
});

describe('amount input character identity', () => {
  it('does not animate the initial amount', () => {
    const state = createAmountInputCharacters('123.00');
    expect(state.characters.every((character) => !character.entering)).toBe(
      true,
    );
  });

  it('only introduces the new character when appending digits or a decimal point', () => {
    let state = createAmountInputCharacters('1');
    for (const text of ['12', '12.', '12.0', '12.00']) {
      const next = updateAmountInputCharacters(state, text);
      expect(next.characters.slice(0, -1)).toEqual(state.characters);
      expect(next.characters.at(-1)?.entering).toBe(true);
      state = next;
    }
  });

  it('keeps the untouched suffix when inserting in the middle', () => {
    const initial = createAmountInputCharacters('12.34');
    const next = updateAmountInputCharacters(initial, '192.34');
    expect(next.characters[0]).toBe(initial.characters[0]);
    expect(next.characters.slice(2)).toEqual(initial.characters.slice(1));
    expect(next.characters[1]).toMatchObject({ char: '9', entering: true });
  });

  it('only replaces the selected digit', () => {
    const initial = createAmountInputCharacters('123.45');
    const next = updateAmountInputCharacters(initial, '193.45');
    expect(next.characters[0]).toBe(initial.characters[0]);
    expect(next.characters[1].id).not.toBe(initial.characters[1].id);
    expect(next.characters.slice(2)).toEqual(initial.characters.slice(2));
  });

  it('never reuses a deleted character during fast backspace and retyping', () => {
    const initial = createAmountInputCharacters('123');
    const deleted = updateAmountInputCharacters(initial, '12');
    const retyped = updateAmountInputCharacters(deleted, '123');
    expect(deleted.characters).toEqual(initial.characters.slice(0, 2));
    expect(retyped.characters[2].id).toBeGreaterThan(initial.characters[2].id);
    expect(updateAmountInputCharacters(retyped, '').characters).toEqual([]);
  });

  it('preserves exact strings when pasting a large token amount', () => {
    const text = '12345678901234567890.000012300';
    const next = updateAmountInputCharacters(
      createAmountInputCharacters(''),
      text,
    );
    expect(next.text).toBe(text);
    expect(next.characters.map(({ char }) => char).join('')).toBe(text);
    expect(new Set(next.characters.map(({ id }) => id)).size).toBe(text.length);
  });
});
