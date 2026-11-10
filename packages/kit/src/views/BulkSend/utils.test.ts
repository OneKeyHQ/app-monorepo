import BigNumber from 'bignumber.js';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

import {
  calculateIsAmountValid,
  generateRandomAmountsFromRange,
  getBulkSendEffectiveRangeMin,
  validateRangeInput,
} from './utils';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: (
    { id }: { id: string },
    values?: Record<string, string | number>,
  ) => (values ? `${id}:${JSON.stringify(values)}` : id),
} as unknown as IntlShape;

const transfersInfo = [
  { from: '0xsender1', to: '0xreceiver1', amount: '' },
  { from: '0xsender2', to: '0xreceiver2', amount: '' },
] as ITransferInfo[];

const minimumAmountError = (amount: string, token: string) =>
  `${ETranslations.send_error_minimum_amount}:${JSON.stringify({
    amount,
    token,
  })}`;

describe('getBulkSendEffectiveRangeMin', () => {
  it('keeps the min the user entered, including an explicit 0', () => {
    expect(
      getBulkSendEffectiveRangeMin({
        rangeMin: '0',
        minTransferAmount: '0.01',
        tokenDecimals: 8,
      }),
    ).toBe('0');
    expect(
      getBulkSendEffectiveRangeMin({
        rangeMin: '1.5',
        minTransferAmount: '0',
        tokenDecimals: 18,
      }),
    ).toBe('1.5');
  });

  it('falls back to the chain minimum transfer amount when min is empty', () => {
    expect(
      getBulkSendEffectiveRangeMin({
        rangeMin: '',
        minTransferAmount: '0.01',
        tokenDecimals: 8,
      }),
    ).toBe('0.01');
  });

  it('falls back to the smallest token unit when the chain has no minimum', () => {
    expect(
      getBulkSendEffectiveRangeMin({
        rangeMin: '',
        minTransferAmount: '0',
        tokenDecimals: 18,
      }),
    ).toBe('0.000000000000000001');
    expect(
      getBulkSendEffectiveRangeMin({
        rangeMin: '',
        tokenDecimals: 6,
      }),
    ).toBe('0.000001');
  });
});

describe('validateRangeInput', () => {
  // OK-66698: ManyToMany / ManyToOne start with both range inputs empty, and
  // the "0" placeholder reads as an already-filled min.
  it('accepts a range that only has a max', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '0.2',
        minTransferAmount: '0',
        tokenSymbol: 'POL',
        tokenDecimals: 18,
        intl,
      }),
    ).toBeUndefined();
  });

  it('rejects a max of 0 when min is empty', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '0',
        minTransferAmount: '0',
        tokenSymbol: 'POL',
        tokenDecimals: 18,
        intl,
      }),
    ).toBe(ETranslations.wallet_bulk_send_error_proper_range);
  });

  it('reports the chain minimum when min is empty and max is below it', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '0.005',
        minTransferAmount: '0.01',
        tokenSymbol: 'DOGE',
        tokenDecimals: 8,
        intl,
      }),
    ).toBe(minimumAmountError('0.01', 'DOGE'));
  });

  it('rejects a max equal to the chain minimum when min is empty', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '0.01',
        minTransferAmount: '0.01',
        tokenSymbol: 'DOGE',
        tokenDecimals: 8,
        intl,
      }),
    ).toBe(ETranslations.wallet_bulk_send_error_proper_range);
  });

  it('accepts a max above the chain minimum when min is empty', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '5',
        minTransferAmount: '0.01',
        tokenSymbol: 'DOGE',
        tokenDecimals: 8,
        intl,
      }),
    ).toBeUndefined();
  });

  it('still rejects an entered min below the chain minimum', () => {
    expect(
      validateRangeInput({
        rangeMin: '0',
        rangeMax: '5',
        minTransferAmount: '0.01',
        tokenSymbol: 'DOGE',
        tokenDecimals: 8,
        intl,
      }),
    ).toBe(minimumAmountError('0.01', 'DOGE'));
  });

  it('still rejects an entered min that is not below max', () => {
    expect(
      validateRangeInput({
        rangeMin: '2',
        rangeMax: '1',
        minTransferAmount: '0',
        tokenSymbol: 'POL',
        tokenDecimals: 18,
        intl,
      }),
    ).toBe(ETranslations.wallet_bulk_send_error_proper_range);
  });

  it('reports nothing while max is still empty', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '',
        minTransferAmount: '0.01',
        tokenSymbol: 'DOGE',
        tokenDecimals: 8,
        intl,
      }),
    ).toBeUndefined();
    expect(
      validateRangeInput({
        rangeMin: '1',
        rangeMax: '',
        minTransferAmount: '0',
        tokenSymbol: 'POL',
        tokenDecimals: 18,
        intl,
      }),
    ).toBeUndefined();
  });

  it('rejects a chain minimum fallback that exceeds the balance', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '5',
        balance: '0.005',
        minTransferAmount: '0.01',
        tokenSymbol: 'DOGE',
        tokenDecimals: 8,
        intl,
      }),
    ).toBe(ETranslations.swap_page_button_insufficient_balance);
  });
  // OneToMany splits one balance across every transfer, and generation caps
  // each amount at balance / transferCount. 0.000008 BTC cannot give two
  // recipients the 0.00000546 dust minimum each.
  it('rejects a shared balance that cannot cover the chain minimum for every transfer', () => {
    const params = {
      rangeMin: '',
      rangeMax: '0.00001',
      balance: '0.000008',
      minTransferAmount: '0.00000546',
      tokenSymbol: 'BTC',
      tokenDecimals: 8,
      intl,
    };

    expect(validateRangeInput({ ...params, transferCount: 2 })).toBe(
      ETranslations.swap_page_button_insufficient_balance,
    );
    expect(
      validateRangeInput({
        ...params,
        rangeMin: '0.00000546',
        transferCount: 2,
      }),
    ).toBe(ETranslations.swap_page_button_insufficient_balance);
    expect(validateRangeInput({ ...params, transferCount: 1 })).toBeUndefined();
    // Without a count the balance belongs to a single sender.
    expect(validateRangeInput(params)).toBeUndefined();
  });

  it('accepts a shared balance that covers the chain minimum for every transfer', () => {
    expect(
      validateRangeInput({
        rangeMin: '',
        rangeMax: '0.00001',
        balance: '0.00001092',
        minTransferAmount: '0.00000546',
        tokenSymbol: 'BTC',
        tokenDecimals: 8,
        transferCount: 2,
        intl,
      }),
    ).toBeUndefined();
  });
});

describe('calculateIsAmountValid (Range)', () => {
  const baseValues = { specifiedAmount: '', rangeMin: '', rangeMax: '' };

  it('is valid with only a max', () => {
    expect(
      calculateIsAmountValid({
        amountInputMode: EAmountInputMode.Range,
        amountInputErrors: {},
        amountInputValues: { ...baseValues, rangeMax: '0.2' },
      }),
    ).toBe(true);
  });

  it('is invalid without a max', () => {
    expect(
      calculateIsAmountValid({
        amountInputMode: EAmountInputMode.Range,
        amountInputErrors: {},
        amountInputValues: baseValues,
      }),
    ).toBe(false);
    expect(
      calculateIsAmountValid({
        amountInputMode: EAmountInputMode.Range,
        amountInputErrors: {},
        amountInputValues: { ...baseValues, rangeMin: '1' },
      }),
    ).toBe(false);
  });

  it('is invalid while a range error is present', () => {
    expect(
      calculateIsAmountValid({
        amountInputMode: EAmountInputMode.Range,
        amountInputErrors: { rangeError: 'error' },
        amountInputValues: { ...baseValues, rangeMax: '0.2' },
      }),
    ).toBe(false);
  });
});

describe('generateRandomAmountsFromRange', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates amounts up to max when min is empty', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const amounts = generateRandomAmountsFromRange({
      transfersInfo,
      rangeMin: '',
      rangeMax: '0.2',
      decimals: 18,
    });

    expect(amounts).toHaveLength(2);
    amounts.forEach((amount) => {
      const amountBN = new BigNumber(amount);
      expect(amountBN.isGreaterThan(0)).toBe(true);
      expect(amountBN.isLessThanOrEqualTo('0.2')).toBe(true);
    });
  });

  it('never generates a zero amount when min is empty', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    expect(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '',
        rangeMax: '5',
        decimals: 0,
      }),
    ).toEqual(['1', '1']);

    const smallAmounts = generateRandomAmountsFromRange({
      transfersInfo,
      rangeMin: '',
      rangeMax: '0.2',
      decimals: 18,
    });

    expect(smallAmounts).toHaveLength(2);
    smallAmounts.forEach((amount) => {
      expect(new BigNumber(amount).isGreaterThan(0)).toBe(true);
    });
  });

  it('floors generated amounts at the chain minimum when min is empty', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const amounts = generateRandomAmountsFromRange({
      transfersInfo,
      rangeMin: '',
      rangeMax: '1',
      decimals: 8,
      minTransferAmount: '0.01',
    });

    expect(amounts).toHaveLength(2);
    amounts.forEach((amount) => {
      expect(new BigNumber(amount).isEqualTo('0.01')).toBe(true);
    });
  });

  it('does not let the fallback min change how amounts are formatted', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '',
        rangeMax: '100',
        decimals: 18,
      }),
    ).toEqual(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '0',
        rangeMax: '100',
        decimals: 18,
      }),
    );
  });

  // NEXA: chain minimum 5.46 with an integer max. Following the max's zero
  // decimals would format 5.68 as "5", below the minimum.
  it('keeps amounts at or above a decimal chain minimum when max is an integer', () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.05)
      .mockReturnValueOnce(0.5);

    expect(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '',
        rangeMax: '10',
        decimals: 2,
        minTransferAmount: '5.46',
      }),
    ).toEqual(['5.68', '7']);
  });

  it('keeps amounts at or above an entered min with more decimals than are shown', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    expect(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '1.23456',
        rangeMax: '5',
        decimals: 18,
      }),
    ).toEqual(['1.23456', '1.23456']);
  });

  // 11.9 / 2 = 5.95 each: below the entered min, yet still above the chain
  // minimum, so rounding to the inputs' zero decimals must not cross it.
  it('keeps balance-capped amounts at or above the chain minimum', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '8',
        rangeMax: '10',
        balance: ['11.9'],
        decimals: 2,
        minTransferAmount: '5.46',
      }),
    ).toEqual(['5.95', '5.95']);
  });

  it('generates nothing without a max', () => {
    expect(
      generateRandomAmountsFromRange({
        transfersInfo,
        rangeMin: '',
        rangeMax: '',
        decimals: 18,
      }),
    ).toEqual([]);
  });
});
