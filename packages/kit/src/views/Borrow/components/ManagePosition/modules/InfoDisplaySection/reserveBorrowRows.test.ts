import type {
  IBorrowApy,
  IBorrowTransactionConfirmation,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { getReserveBorrowRowKinds } from './reserveBorrowRows';

const text = (value: string): IEarnText => ({ text: value });
const pair = (current: string, latest?: string) => ({
  current: { title: text(current), description: text('') },
  ...(latest ? { latest: { title: text(latest), description: text('') } } : {}),
});

const apyDetail: IBorrowApy = { apy: '0.29', highlight: { text: '0.29%' } };
const borrowAnswer: IBorrowTransactionConfirmation = {
  myBorrow: pair('0.00001847'),
  apyDetail,
};
const holdsBoth = { hasSupply: true, hasBorrow: true };
const holdsNone = { hasSupply: false, hasBorrow: false };

describe('getReserveBorrowRowKinds', () => {
  it('holds My Borrow and Borrow APY in place before the first answer', () => {
    expect(
      getReserveBorrowRowKinds({
        action: 'borrow',
        position: holdsBoth,
        isForTypedAmount: false,
        showApyDetail: true,
        offersSwap: true,
      }),
    ).toEqual(['my-borrow', 'apy']);
  });

  it('holds no zero loan in place before the first answer with nothing typed', () => {
    const base = {
      action: 'borrow' as const,
      position: holdsNone,
      showApyDetail: true,
      offersSwap: false,
    };
    expect(
      getReserveBorrowRowKinds({ ...base, isForTypedAmount: false }),
    ).toEqual(['apy']);
    // An amount typed: its answer will show what it makes of the loan
    expect(
      getReserveBorrowRowKinds({ ...base, isForTypedAmount: true }),
    ).toEqual(['my-borrow', 'apy']);
  });

  it("lists a loan's rows as the outlined card orders them", () => {
    expect(
      getReserveBorrowRowKinds({
        action: 'borrow',
        confirmation: {
          ...borrowAnswer,
          healthFactor: {
            current: { title: text('3.08') },
            latest: { title: text('1.8') },
          },
          myBorrow: pair('0.00001847', '0.00001947'),
        },
        position: holdsBoth,
        isForTypedAmount: true,
        showApyDetail: true,
        offersSwap: true,
      }),
    ).toEqual(['health-factor', 'my-borrow', 'apy']);
  });

  it('leaves out a loan the account does not have only while nothing is typed', () => {
    const base = {
      action: 'borrow' as const,
      position: holdsNone,
      showApyDetail: true,
      offersSwap: false,
    };
    expect(
      getReserveBorrowRowKinds({
        ...base,
        confirmation: { ...borrowAnswer, myBorrow: pair('0') },
        isForTypedAmount: false,
      }),
    ).toEqual(['apy']);
    // 0 → 1 USDT: what the borrow makes of it
    expect(
      getReserveBorrowRowKinds({
        ...base,
        confirmation: { ...borrowAnswer, myBorrow: pair('0', '1') },
        isForTypedAmount: true,
      }),
    ).toEqual(['my-borrow', 'apy']);
  });

  it('lists the position rows where the page has not read the position', () => {
    expect(
      getReserveBorrowRowKinds({
        action: 'borrow',
        confirmation: { ...borrowAnswer, myBorrow: pair('0') },
        isForTypedAmount: false,
        showApyDetail: true,
        offersSwap: false,
      }),
    ).toEqual(['my-borrow', 'apy']);
  });

  it("lists My Supply where a loan's answer has it, unless the account supplies none and nothing is typed", () => {
    const base = {
      action: 'borrow' as const,
      confirmation: {
        mySupply: pair('0.5'),
        myBorrow: pair('0.00001847', '0.00002847'),
      },
      showApyDetail: false,
      offersSwap: false,
    };
    expect(
      getReserveBorrowRowKinds({
        ...base,
        position: holdsBoth,
        isForTypedAmount: false,
      }),
    ).toEqual(['my-supply', 'my-borrow']);
    expect(
      getReserveBorrowRowKinds({
        ...base,
        position: { hasSupply: false, hasBorrow: true },
        isForTypedAmount: false,
      }),
    ).toEqual(['my-borrow']);
    expect(
      getReserveBorrowRowKinds({
        ...base,
        position: { hasSupply: false, hasBorrow: true },
        isForTypedAmount: true,
      }),
    ).toEqual(['my-supply', 'my-borrow']);
  });

  it('ends a repayment with "Not enough X?" and its Swap', () => {
    expect(
      getReserveBorrowRowKinds({
        action: 'repay',
        confirmation: { myBorrow: pair('0.00001847', '0.00000847') },
        position: holdsBoth,
        isForTypedAmount: true,
        showApyDetail: true,
        offersSwap: true,
      }),
    ).toEqual(['my-borrow', 'swap']);
  });

  it('gives a borrow no Swap row', () => {
    expect(
      getReserveBorrowRowKinds({
        action: 'borrow',
        confirmation: borrowAnswer,
        position: holdsBoth,
        isForTypedAmount: false,
        showApyDetail: false,
        offersSwap: true,
      }),
    ).toEqual(['my-borrow']);
  });

  it('shows the collateral switch only where the answer says its state', () => {
    const base = {
      action: 'repay' as const,
      position: holdsBoth,
      isForTypedAmount: false,
      showApyDetail: false,
      offersSwap: false,
    };
    expect(
      getReserveBorrowRowKinds({
        ...base,
        confirmation: { canBeCollateral: true },
      }),
    ).toEqual([]);
    expect(
      getReserveBorrowRowKinds({
        ...base,
        confirmation: { canBeCollateral: true, usageAsCollateral: false },
      }),
    ).toEqual(['collateral']);
    expect(
      getReserveBorrowRowKinds({
        ...base,
        confirmation: { canBeCollateral: false },
      }),
    ).toEqual(['collateral']);
  });
});
