import {
  buildBorrowPositionEntries,
  sortBorrowPositions,
} from './borrowMobilePositions.utils';

import type { IBorrowPositionSortable } from './borrowMobilePositions.utils';

type ILabelledEntry = IBorrowPositionSortable & { label: string };
type IBuildPositionParams = Parameters<typeof buildBorrowPositionEntries>[0];
type ISuppliedAsset = NonNullable<
  IBuildPositionParams['suppliedAssets']
>[number];
type IBorrowedAsset = NonNullable<
  IBuildPositionParams['borrowedAssets']
>[number];

const entry = (
  kind: IBorrowPositionSortable['kind'],
  label: string,
  fiatValue?: string,
): ILabelledEntry => ({ kind, label, fiatValue });

const describeOrder = (entries: ILabelledEntry[]) =>
  sortBorrowPositions(entries).map((e) => `${e.kind}:${e.label}`);

describe('sortBorrowPositions', () => {
  it('groups debt first and sorts each side by numeric fiat value', () => {
    expect(
      describeOrder([
        entry('supplied', 'dai', '1000'),
        entry('borrowed', 'usdc', '90'),
        entry('borrowed', 'eighty', '80'),
        entry('borrowed', 'nine', '9'),
        entry('supplied', 'usdc', '5'),
        entry('supplied', 'nofiat'),
      ]),
    ).toEqual([
      'borrowed:usdc',
      'borrowed:eighty',
      'borrowed:nine',
      'supplied:dai',
      'supplied:usdc',
      'supplied:nofiat',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [entry('supplied', 'a', '1'), entry('borrowed', 'b', '9')];
    const snapshot = [...input];
    sortBorrowPositions(input);
    expect(input).toEqual(snapshot);
  });
});

describe('buildBorrowPositionEntries', () => {
  const buildBalance = (number: string) => ({
    number,
    fiatValue: number,
    title: { text: number },
    description: { text: number },
  });

  it('keeps owned native positions even when the action gateway is unsupported', () => {
    const suppliedAsset = {
      reserveAddress: '',
      suppliedAmount: buildBalance('1'),
    } as ISuppliedAsset;
    const borrowedAsset = {
      reserveAddress: '',
      borrowedAmount: buildBalance('2'),
    } as IBorrowedAsset;

    expect(
      buildBorrowPositionEntries({
        suppliedAssets: [suppliedAsset],
        borrowedAssets: [borrowedAsset],
      }),
    ).toEqual([
      {
        kind: 'borrowed',
        fiatValue: '2',
        asset: borrowedAsset,
      },
      {
        kind: 'supplied',
        fiatValue: '1',
        asset: suppliedAsset,
      },
    ]);
  });

  it('still excludes entries without a positive owned balance', () => {
    expect(
      buildBorrowPositionEntries({
        suppliedAssets: [
          {
            reserveAddress: '0xsupply',
            suppliedAmount: buildBalance('0'),
          } as ISuppliedAsset,
        ],
        borrowedAssets: [
          {
            reserveAddress: '0xborrow',
            borrowedAmount: buildBalance('0'),
          } as IBorrowedAsset,
        ],
      }),
    ).toEqual([]);
  });
});
