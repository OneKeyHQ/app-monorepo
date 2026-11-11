import {
  clearMoneroPortfolioDraft,
  readMoneroPortfolioDraft,
  saveMoneroPortfolioDraft,
} from './moneroPortfolioDraft';

it('restores only the same wallet/indexed account across a network switch and clears on completion', () => {
  const owner = {
    walletId: 'wallet-1',
    indexedAccountId: 'wallet-1-0',
    accountId: 'evm-account',
  };
  const selection = {
    enabledNetworks: { 'evm--1': true, 'xmr--0': true },
    disabledNetworks: { 'btc--0': true },
  };
  saveMoneroPortfolioDraft(owner, selection);
  expect(
    readMoneroPortfolioDraft({ ...owner, accountId: 'xmr-account' }),
  ).toEqual(selection);
  expect(
    readMoneroPortfolioDraft({ ...owner, indexedAccountId: 'wallet-1-1' }),
  ).toBeUndefined();
  expect(
    readMoneroPortfolioDraft({ ...owner, walletId: 'wallet-2' }),
  ).toBeUndefined();
  clearMoneroPortfolioDraft({ ...owner, walletId: 'wallet-2' });
  expect(readMoneroPortfolioDraft(owner)).toEqual(selection);
  clearMoneroPortfolioDraft(owner);
  expect(readMoneroPortfolioDraft(owner)).toBeUndefined();
});
