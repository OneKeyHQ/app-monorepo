import { EManagePositionType } from '@onekeyhq/shared/types/staking';

import {
  getReserveFooterActions,
  getReserveFormSides,
  getReserveSideForm,
  getReserveSideStartAmount,
  isHistoryCrowded,
  resolveReserveFormSide,
  withSideInUse,
} from './reserveFormSides';

describe('getReserveFormSides', () => {
  it('offers Supply alone for a reserve that lends nothing to an account without a position', () => {
    expect(
      getReserveFormSides({
        hasSupplied: false,
        canBorrow: false,
        hasBorrowed: false,
      }),
    ).toEqual(['supply']);
  });

  it('adds Borrow where the reserve lends (USDT on Aave Core)', () => {
    expect(
      getReserveFormSides({
        hasSupplied: false,
        canBorrow: true,
        hasBorrowed: false,
      }),
    ).toEqual(['supply', 'borrow']);
  });

  it('adds Withdraw for a supplier (ETH on Aave Core)', () => {
    expect(
      getReserveFormSides({
        hasSupplied: true,
        canBorrow: true,
        hasBorrowed: false,
      }),
    ).toEqual(['supply', 'withdraw', 'borrow']);
  });

  it('adds Repay for a borrower (cbBTC on Aave Core)', () => {
    expect(
      getReserveFormSides({
        hasSupplied: false,
        canBorrow: true,
        hasBorrowed: true,
      }),
    ).toEqual(['supply', 'borrow', 'repay']);
  });

  it('keeps Repay for a debt the reserve no longer lends more of', () => {
    expect(
      getReserveFormSides({
        hasSupplied: true,
        canBorrow: false,
        hasBorrowed: true,
      }),
    ).toEqual(['supply', 'withdraw', 'repay']);
  });
});

describe('resolveReserveFormSide', () => {
  const sides = getReserveFormSides({
    hasSupplied: false,
    canBorrow: true,
    hasBorrowed: false,
  });

  it('opens on the side asked for where it applies', () => {
    expect(resolveReserveFormSide({ requested: 'borrow', sides })).toBe(
      'borrow',
    );
  });

  it('falls back to Supply where the side asked for does not apply', () => {
    expect(resolveReserveFormSide({ requested: 'withdraw', sides })).toBe(
      'supply',
    );
    expect(resolveReserveFormSide({ requested: 'repay', sides })).toBe(
      'supply',
    );
  });

  it('opens on Supply without a side asked for', () => {
    expect(resolveReserveFormSide({ sides })).toBe('supply');
  });
});

describe('withSideInUse', () => {
  it('leaves the sides as they are when the one in use applies', () => {
    expect(
      withSideInUse({ sides: ['supply', 'borrow'], side: 'borrow' }),
    ).toEqual(['supply', 'borrow']);
  });

  it('keeps a side that stopped applying while it is in use, in its place', () => {
    expect(
      withSideInUse({ sides: ['supply', 'borrow'], side: 'withdraw' }),
    ).toEqual(['supply', 'withdraw', 'borrow']);
    expect(withSideInUse({ sides: ['supply'], side: 'repay' })).toEqual([
      'supply',
      'repay',
    ]);
  });
});

describe('getReserveSideForm', () => {
  it('maps each side to one side of the manage window form', () => {
    expect(getReserveSideForm('supply')).toEqual({
      type: EManagePositionType.Supply,
      depositOnly: true,
      withdrawOnly: false,
    });
    expect(getReserveSideForm('withdraw')).toEqual({
      type: EManagePositionType.Supply,
      depositOnly: false,
      withdrawOnly: true,
    });
    expect(getReserveSideForm('borrow')).toEqual({
      type: EManagePositionType.Borrow,
      depositOnly: true,
      withdrawOnly: false,
    });
    expect(getReserveSideForm('repay')).toEqual({
      type: EManagePositionType.Borrow,
      depositOnly: false,
      withdrawOnly: true,
    });
  });
});

describe('getReserveSideStartAmount', () => {
  it('fills the amount into the side it was typed for', () => {
    expect(
      getReserveSideStartAmount({
        side: 'borrow',
        requested: 'borrow',
        amount: '120',
      }),
    ).toBe('120');
    expect(
      getReserveSideStartAmount({
        side: 'supply',
        requested: 'supply',
        amount: '0.5',
      }),
    ).toBe('0.5');
  });

  it('keeps a loan amount out of the Supply form the page fell back to', () => {
    expect(
      getReserveSideStartAmount({
        side: 'supply',
        requested: 'borrow',
        amount: '120',
      }),
    ).toBeUndefined();
  });

  it('gives Withdraw and Repay no start amount', () => {
    expect(
      getReserveSideStartAmount({
        side: 'repay',
        requested: 'repay',
        amount: '1',
      }),
    ).toBeUndefined();
    expect(
      getReserveSideStartAmount({
        side: 'withdraw',
        requested: 'withdraw',
        amount: '1',
      }),
    ).toBeUndefined();
  });
});

describe('getReserveFooterActions', () => {
  it('offers Supply, and Borrow where the reserve lends', () => {
    expect(
      getReserveFooterActions({
        canBorrow: true,
        isNativeActionUnsupported: false,
      }),
    ).toEqual({
      supply: { disabled: false },
      borrow: { disabled: false },
    });
    expect(
      getReserveFooterActions({
        canBorrow: false,
        isNativeActionUnsupported: false,
      }),
    ).toEqual({ supply: { disabled: false } });
  });

  it('turns both off for an Aave native reserve without gateway support', () => {
    expect(
      getReserveFooterActions({
        canBorrow: true,
        isNativeActionUnsupported: true,
      }),
    ).toEqual({
      supply: { disabled: true },
      borrow: { disabled: true },
    });
  });
});

describe('isHistoryCrowded', () => {
  it('keeps the word until every width is known', () => {
    expect(
      isHistoryCrowded({
        lineWidth: 0,
        switchWidth: 300,
        historyWidth: 92,
        gap: 12,
      }),
    ).toBe(false);
    expect(
      isHistoryCrowded({
        lineWidth: 320,
        switchWidth: 300,
        historyWidth: 0,
        gap: 12,
      }),
    ).toBe(false);
  });

  it('keeps the word beside two or three sides in a wide column', () => {
    expect(
      isHistoryCrowded({
        lineWidth: 359,
        switchWidth: 211,
        historyWidth: 92,
        gap: 12,
      }),
    ).toBe(false);
  });

  it('takes the icon where four sides fill the line', () => {
    expect(
      isHistoryCrowded({
        lineWidth: 359,
        switchWidth: 300,
        historyWidth: 92,
        gap: 12,
      }),
    ).toBe(true);
  });
});
