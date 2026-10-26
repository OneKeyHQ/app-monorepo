import {
  createEnableBirthdayForm,
  readEnableBirthday,
} from './LocalWalletRepairControls';

jest.mock('@onekeyhq/components', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({}));

describe('birthday date precision', () => {
  it.each([new Date(2024, 1, 29, 18, 30), new Date(2025, 6, 19, 9, 45)])(
    'preserves the selected local day, including leap day (%s)',
    (date) => {
      expect(
        readEnableBirthday({ mode: 'date', date }, undefined, 'zec--0'),
      ).toEqual({
        birthdayTimestamp: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        ).getTime(),
      });
    },
  );

  it('uses the explicit height without a stale date', () => {
    expect(
      readEnableBirthday(
        { mode: 'height', date: new Date(2025, 6, 19), height: ' 2500000 ' },
        undefined,
        'zec--0',
      ),
    ).toEqual({ birthdayHeight: 2_500_000 });
  });

  it.each(['date', 'height'] as const)(
    'lets the earliest-start choice override %s input',
    (mode) => {
      const earliest = { height: 1_687_104, timestamp: 1_653_955_200_000 };
      expect(
        readEnableBirthday(
          { mode, date: new Date(2025, 6, 19), fromEarliest: true },
          earliest,
          'zec--0',
        ),
      ).toEqual({ birthdayHeight: earliest.height });
    },
  );

  it.each(['', 'abc', '-1', '0', '1.5', '1e6', '9007199254740992'])(
    'rejects an empty, non-integer or unsafe height (%s)',
    (height) => {
      expect(
        readEnableBirthday(
          { mode: 'height', date: null, height },
          undefined,
          'zec--0',
        ),
      ).toBeUndefined();
    },
  );

  it('requires manual heights at or above the supported chain floor', () => {
    const earliest = { height: 1_687_104, timestamp: 1_653_955_200_000 };
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '1687103' },
        earliest,
        'zec--0',
      ),
    ).toBeUndefined();
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '1687104' },
        earliest,
        'zec--0',
      ),
    ).toEqual({ birthdayHeight: earliest.height });
  });

  it('rejects values that would overflow the Zcash runtime height', () => {
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '4294967296' },
        undefined,
        'zec--0',
      ),
    ).toBeUndefined();
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '4294967295' },
        undefined,
        'zec--0',
      ),
    ).toEqual({ birthdayHeight: 4_294_967_295 });
  });

  it.each([null, new Date(Number.NaN)])(
    'rejects an empty or invalid date',
    (date) => {
      expect(
        readEnableBirthday({ mode: 'date', date }, undefined, 'zec--0'),
      ).toBeUndefined();
    },
  );

  it('defaults to the recommended date without truncating its day', () => {
    const hint = new Date(2025, 6, 19).getTime();
    const form = createEnableBirthdayForm(hint);
    expect(form.current.mode).toBe('date');
    expect(readEnableBirthday(form.current, undefined, 'zec--0')).toEqual({
      birthdayTimestamp: hint,
    });
  });
});
