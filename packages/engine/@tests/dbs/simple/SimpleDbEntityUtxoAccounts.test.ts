import simpleDb from '../../../src/dbs/simple/simpleDb';

describe('SimpleDbEntityUtxoAccounts', () => {
  beforeEach(() => {
    simpleDb.utxoAccounts.clearRawData();
  });

  const networkId = 'btc--0';
  const utxo = {
    txid: '9490a0af96a893239ccc4d3816f4f012f69360a347b220b36c2ece066b0e0fa3',
    vout: 0,
    value: '3000',
    height: 784900,
    confirmations: 112,
    address: '37i5rvSfAi3dk31sRUqywKsUCDSdo2nrMQ',
    path: "m/49'/0'/0'/0/0",
  };
  const xpub1 =
    'ypub6YHeP4xR81KXQzQCgTtmmWM7X9D7NFDhRkHZWPT6yLGxKyF8xqUy5w1yQiL8ff7iC8eErcPr3SEofKtc2rnEtv8L44zNkdJEEkp2dkdnk';
  const xpub2 =
    'zpub6YHeP4xR81KXQzQCgTtmmWM7X9D7NFDhRkHZWPT6yLGxKyF8xqUy5w1yQiL8ff7iC8eErcPr3SEofKtc2rnEtv8L44zNkdJEEkp2dkdnk';

  test('addCoinControlItem should add an item', async () => {
    await simpleDb.utxoAccounts.addCoinControlItem(networkId, utxo, xpub1, {
      label: 'MockLabel',
      frozen: false,
      recycle: false,
    });
    const items = await simpleDb.utxoAccounts.getCoinControlList(
      networkId,
      xpub1,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: `${networkId}_${utxo.txid}_${utxo.vout}`,
      networkId,
      xpub: xpub1,
      label: 'MockLabel',
      frozen: false,
      recycle: false,
      key: `${utxo.txid}_${utxo.vout}`,
    });
  });

  test('getCoinControlList should filter by networkId and xpub', async () => {
    await simpleDb.utxoAccounts.addCoinControlItem(networkId, utxo, xpub1, {
      label: 'Label1',
      frozen: true,
      recycle: false,
    });
    await simpleDb.utxoAccounts.addCoinControlItem(
      networkId,
      { ...utxo, vout: 2 },
      xpub2,
      {
        label: 'label2',
        frozen: true,
        recycle: false,
      },
    );
    const items = await simpleDb.utxoAccounts.getCoinControlList(
      networkId,
      xpub1,
    );
    expect(items).toHaveLength(1);
    expect(items[0].xpub).toEqual(xpub1);
  });

  test('updateCoinControlItem should update an item', async () => {
    await simpleDb.utxoAccounts.addCoinControlItem(networkId, utxo, xpub1, {
      label: 'label1',
      frozen: true,
      recycle: false,
    });
    const id = `${networkId}_${utxo.txid}_${utxo.vout}`;
    await simpleDb.utxoAccounts.updateCoinControlItem(id, {
      label: 'new label',
      frozen: false,
      recycle: false,
    });
    const items = await simpleDb.utxoAccounts.getCoinControlById(id);
    expect(items?.label).toEqual('new label');
  });

  test('deleteCoinControlItem should delete items', async () => {
    await simpleDb.utxoAccounts.addCoinControlItem(networkId, utxo, xpub1, {
      label: 'label1',
      frozen: true,
      recycle: false,
    });
    await simpleDb.utxoAccounts.addCoinControlItem(
      networkId,
      { ...utxo, vout: 2 },
      xpub1,
      {
        label: 'label2',
        frozen: false,
        recycle: false,
      },
    );
    await simpleDb.utxoAccounts.deleteCoinControlItem([
      `${networkId}_${utxo.txid}_${utxo.vout}`,
    ]);
    const items = await simpleDb.utxoAccounts.getCoinControlList(
      networkId,
      xpub1,
    );
    expect(items).toHaveLength(1);
    expect(items[0].id).toEqual(`${networkId}_${utxo.txid}_${2}`);
  });
});
