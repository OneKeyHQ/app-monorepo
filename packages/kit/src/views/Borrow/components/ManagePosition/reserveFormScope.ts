import { createContext, useContext } from 'react';

/**
 * What a page about one reserve tells the lending form under it (the Borrow
 * reserve page, demo 11-03). Its being there keeps the form to that reserve:
 * the amount box offers no other asset. Once the page has read what the
 * account holds of the reserve, My Supply and My Borrow show with nothing
 * typed only where there is one, so no zero balance is listed. Without it
 * the form is as it always was
 */
export type IBorrowReserveFormScope = {
  position?: {
    hasSupply: boolean;
    hasBorrow: boolean;
  };
};

export const BorrowReserveFormScopeContext = createContext<
  IBorrowReserveFormScope | undefined
>(undefined);

export function useBorrowReserveFormScope() {
  return useContext(BorrowReserveFormScopeContext);
}

/**
 * Whether a position row (My Supply, My Borrow) stays out: only for a
 * position the account doesn't hold, and only while nothing is typed. An
 * amount typed shows what it makes of it (0 → 1 USDT)
 */
export function hidesPositionNotHeld({
  holds,
  hasAmount,
}: {
  // Unknown until the page has read the account's position
  holds?: boolean;
  hasAmount: boolean;
}) {
  return holds === false && !hasAmount;
}
