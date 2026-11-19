import {
  captureEmptyMoneroPortfolioDraft,
  clearMoneroPortfolioDraft,
  handoffEmptyMoneroPortfolioDraft,
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

it('moves only the captured empty-wallet draft to the explicitly created index', () => {
  const empty = {
    walletId: 'wallet-empty',
    indexedAccountId: undefined,
    accountId: undefined,
  };
  const selection = {
    enabledNetworks: { 'xmr--0': true, 'eth--1': true },
    disabledNetworks: {},
  };
  saveMoneroPortfolioDraft(empty, selection);
  const source = captureEmptyMoneroPortfolioDraft(empty.walletId);
  expect(source).toBeDefined();
  expect(
    readMoneroPortfolioDraft({ ...empty, indexedAccountId: 'wallet-empty--1' }),
  ).toBeUndefined();
  handoffEmptyMoneroPortfolioDraft({
    source,
    walletId: 'wallet-other',
    indexedAccountId: 'wallet-other--0',
  });
  expect(readMoneroPortfolioDraft(empty)).toEqual(selection);
  handoffEmptyMoneroPortfolioDraft({
    source,
    walletId: empty.walletId,
    indexedAccountId: 'wallet-empty--0',
  });
  expect(readMoneroPortfolioDraft(empty)).toBeUndefined();
  expect(
    readMoneroPortfolioDraft({ ...empty, indexedAccountId: 'wallet-empty--0' }),
  ).toEqual(selection);
  expect(
    readMoneroPortfolioDraft({ ...empty, indexedAccountId: 'wallet-empty--1' }),
  ).toBeUndefined();
  clearMoneroPortfolioDraft({ ...empty, indexedAccountId: 'wallet-empty--0' });
});

it('does not move a replacement draft using a stale empty-wallet token', () => {
  const empty = {
    walletId: 'wallet-empty',
    indexedAccountId: undefined,
    accountId: undefined,
  };
  const selection = {
    enabledNetworks: { 'xmr--0': true },
    disabledNetworks: {},
  };
  saveMoneroPortfolioDraft(empty, selection);
  const source = captureEmptyMoneroPortfolioDraft(empty.walletId);
  saveMoneroPortfolioDraft(empty, {
    ...selection,
    disabledNetworks: { 'eth--1': true },
  });
  handoffEmptyMoneroPortfolioDraft({
    source,
    walletId: empty.walletId,
    indexedAccountId: 'wallet-empty--0',
  });
  expect(
    readMoneroPortfolioDraft({ ...empty, indexedAccountId: 'wallet-empty--0' }),
  ).toBeUndefined();
  expect(readMoneroPortfolioDraft(empty)?.disabledNetworks).toEqual({
    'eth--1': true,
  });
  clearMoneroPortfolioDraft(empty);
});
