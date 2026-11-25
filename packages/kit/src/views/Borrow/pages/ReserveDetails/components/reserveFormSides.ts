import type { IBorrowReserveFormTab } from '@onekeyhq/shared/src/routes';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';

// The reserve page's form (demo 11-03): one switch over the four sides of a
// lending market reserve, each side the Borrow manage window's own form

// The order the switch reads in
export const RESERVE_FORM_SIDE_ORDER: IBorrowReserveFormTab[] = [
  'supply',
  'withdraw',
  'borrow',
  'repay',
];

/**
 * The sides that apply to the account and the reserve: Supply always,
 * Withdraw once something is supplied, Borrow where the reserve lends, Repay
 * once something is borrowed
 */
export function getReserveFormSides({
  hasSupplied,
  canBorrow,
  hasBorrowed,
}: {
  hasSupplied: boolean;
  canBorrow: boolean;
  hasBorrowed: boolean;
}): IBorrowReserveFormTab[] {
  const applies: Record<IBorrowReserveFormTab, boolean> = {
    supply: true,
    withdraw: hasSupplied,
    borrow: canBorrow,
    repay: hasBorrowed,
  };
  return RESERVE_FORM_SIDE_ORDER.filter((side) => applies[side]);
}

// The side the page opens on: the one asked for where it applies, else Supply
export function resolveReserveFormSide({
  requested,
  sides,
}: {
  requested?: IBorrowReserveFormTab;
  sides: IBorrowReserveFormTab[];
}): IBorrowReserveFormTab {
  return requested && sides.includes(requested) ? requested : 'supply';
}

/**
 * The sides the switch shows: those that apply, and the one in use even
 * once it no longer does (a repayment that cleared the loan stays on Repay
 * until the user leaves it)
 */
export function withSideInUse({
  sides,
  side,
}: {
  sides: IBorrowReserveFormTab[];
  side: IBorrowReserveFormTab;
}): IBorrowReserveFormTab[] {
  if (sides.includes(side)) {
    return sides;
  }
  return RESERVE_FORM_SIDE_ORDER.filter(
    (item) => item === side || sides.includes(item),
  );
}

export type IReserveSideForm = {
  // The manage window's form behind the side: its supply pair or its borrow
  // pair, one side of it shown
  type: EManagePositionType.Supply | EManagePositionType.Borrow;
  depositOnly: boolean;
  withdrawOnly: boolean;
};

export function getReserveSideForm(
  side: IBorrowReserveFormTab,
): IReserveSideForm {
  const isBorrowPair = side === 'borrow' || side === 'repay';
  const isSecondSide = side === 'withdraw' || side === 'repay';
  return {
    type: isBorrowPair
      ? EManagePositionType.Borrow
      : EManagePositionType.Supply,
    depositOnly: !isSecondSide,
    withdrawOnly: isSecondSide,
  };
}

// The amount a route brings goes to the side it was typed for, and only
// while that side is the one shown
export function getReserveSideStartAmount({
  side,
  requested,
  amount,
}: {
  side: IBorrowReserveFormTab;
  requested?: IBorrowReserveFormTab;
  amount?: string;
}): string | undefined {
  // Withdraw and Repay take no start amount in their forms
  const takesAmount = side === 'supply' || side === 'borrow';
  return takesAmount && side === requested && amount ? amount : undefined;
}

export type IReserveFooterActions = {
  supply: { disabled: boolean };
  // Only where the reserve lends
  borrow?: { disabled: boolean };
};

/**
 * The narrow page's footer: Supply, and Borrow where the reserve lends. Each
 * opens the manage window, which says itself what an amount can't do; only a
 * native reserve the market can't build for is off here
 */
export function getReserveFooterActions({
  canBorrow,
  isNativeActionUnsupported,
}: {
  canBorrow: boolean;
  isNativeActionUnsupported: boolean;
}): IReserveFooterActions {
  return {
    supply: { disabled: isNativeActionUnsupported },
    ...(canBorrow ? { borrow: { disabled: isNativeActionUnsupported } } : {}),
  };
}

/**
 * Whether History gives up its word for an icon: three or four sides can
 * leave the line no room for it. Until every width is known it keeps it
 */
export function isHistoryCrowded({
  lineWidth,
  switchWidth,
  historyWidth,
  gap,
}: {
  lineWidth: number;
  switchWidth: number;
  // History with its word, as last measured
  historyWidth: number;
  gap: number;
}): boolean {
  if (lineWidth <= 0 || switchWidth <= 0 || historyWidth <= 0) {
    return false;
  }
  return switchWidth + gap + historyWidth > lineWidth;
}
