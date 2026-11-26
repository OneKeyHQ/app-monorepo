import { buildHolderRow, holderLayout } from './holderTable';

const account = {
  accountAddress: '0x123456789abcdef0123456789abcdef012345678',
  amount: '1000000',
  fiatValue: '12345',
  percentage: '0.00',
};
const actions = [
  { name: 'Copy3Outline', actionKey: 'copy', accessibilityLabel: 'Copy' },
  {
    name: 'OpenOutline',
    actionKey: 'explorer',
    accessibilityLabel: 'Open in explorer',
  },
];

it.each([0, 511, 512, 513])(
  'uses the measured column budget at %i',
  (width) => {
    const row = buildHolderRow(
      account,
      0,
      'evm--1',
      holderLayout(width),
      actions,
    );
    const wide = width >= 512;
    expect(row.tableColumns?.map((col) => col.key)).toEqual(
      wide
        ? ['rank', 'address', 'share', 'amount', 'value']
        : ['rank', 'address', 'share', 'value'],
    );
    expect(row.tableColumns?.[1]).toMatchObject({
      actions,
      actionPlacement: wide ? 'inline' : 'below',
    });
    expect(row.tableColumns?.[2].text).toBe('<0.01%');
    expect(row.height).toBe(wide ? 40 : 52);
  },
);

it('keeps the same account identity when rank and balances change', () => {
  const layout = holderLayout(768);
  const row = buildHolderRow(account, 1, 'evm--1', layout, actions);
  const next = buildHolderRow(
    { ...account, percentage: undefined, fiatValue: '19' },
    3,
    'evm--1',
    layout,
    actions,
  );
  expect(next.key).toBe(row.key);
  expect(next.tableColumns?.[2].text).toBe('-');
  expect(next.tableColumns?.[4].text).toContain('19');
  expect(buildHolderRow(account, 1, 'evm--10', layout, actions).key).not.toBe(
    row.key,
  );
});
