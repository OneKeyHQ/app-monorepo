// cspell:ignore keyhash vkey vkeys Vkeywitnesses

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const babel = require('@babel/core');

const packageRoot = path.resolve(
  __dirname,
  '../../node_modules/@onekeyfe/cardano-coin-selection-asmjs',
);
const modules = Promise.all([
  import(
    pathToFileURL(
      path.resolve(
        __dirname,
        '../../node_modules/@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib.js',
      ),
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(
        __dirname,
        '../../node_modules/@emurgo/cardano-message-signing-asmjs/cardano_message_signing.js',
      ),
    ).href
  ),
]);

// Node cannot resolve the browser-only CSL package entry. Load its actual
// ASM.js implementation, then execute each shipped SDK module with that namespace.
function loadSdk(format, Cardano, CardanoMessage) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs.readFileSync(filename, 'utf8');
    const code =
      format === 'esm'
        ? babel.transformSync(source, {
            filename,
            configFile: false,
            babelrc: false,
            plugins: ['@babel/plugin-transform-modules-commonjs'],
          }).code
        : source;
    const localRequire = createRequire(filename);
    const sdkRequire = (name) => {
      if (name === '@emurgo/cardano-serialization-lib-asmjs') return Cardano;
      if (name.startsWith('@emurgo/cardano-message-signing-asmjs')) {
        return CardanoMessage;
      }
      if (!name.startsWith('.')) return require(name);
      return load(localRequire.resolve(name));
    };
    vm.compileFunction(code, ['exports', 'require', 'module'], { filename })(
      module.exports,
      sdkRequire,
      module,
    );
    return module.exports;
  }
  return (entry) => load(path.join(packageRoot, 'lib', format, entry));
}

function fixture(
  Cardano,
  { tagged = false, map = true, foreign = false } = {},
) {
  // Generate disposable signing material at runtime; all transaction data is synthetic.
  const root = Cardano.Bip32PrivateKey.from_bip39_entropy(
    randomBytes(32),
    new Uint8Array(),
  );
  const account = root
    .derive(0x80_00_07_3c)
    .derive(0x80_00_07_17)
    .derive(0x80_00_00_00);
  const payment = account.derive(0).derive(0).to_raw_key();
  const stake = account.derive(2).derive(0).to_raw_key();
  const address = Cardano.BaseAddress.new(
    1,
    Cardano.Credential.from_keyhash(payment.to_public().hash()),
    Cardano.Credential.from_keyhash(stake.to_public().hash()),
  )
    .to_address()
    .to_bech32();
  const input = `825820${'22'.repeat(32)}00`;
  const inputs = `${tagged ? 'd90102' : ''}${foreign ? '82' : '81'}${input}${foreign ? `825820${'33'.repeat(32)}00` : ''}`;
  const recipient = `581d61${'44'.repeat(28)}`;
  const output = map
    ? `a200${recipient}011a001e8480`
    : `82${recipient}1a001e8480`;
  const body = `a300${inputs}0181${output}021a0002bf20`;
  const tx = `84${body}a0f5f6`;
  const fixed = Cardano.FixedTransaction.from_hex(tx);
  const utxos = [
    {
      address,
      tx_hash: '22'.repeat(32),
      tx_index: 0,
      output_index: 0,
      amount: [{ unit: 'lovelace', quantity: '2180000' }],
    },
  ];
  const changeAddress = {
    address,
    addressParameters: {
      path: "m/1852'/1815'/0'/0/0",
      stakingPath: "m/1852'/1815'/0'/2/0",
    },
  };
  return {
    root,
    account,
    payment,
    body,
    tx,
    fixed,
    utxos,
    address,
    changeAddress,
  };
}

function hardwareWitness(Cardano, hash, key) {
  const witness = Cardano.make_vkey_witness(hash, key);
  return {
    type: 1,
    pubKey: witness.vkey().public_key().to_hex(),
    signature: witness.signature().to_hex(),
  };
}

for (const format of ['cjs', 'esm']) {
  for (const tagged of [false, true]) {
    for (const map of [false, true]) {
      test(`${format}: ${tagged ? 'tagged' : 'plain'} inputs, ${map ? 'map' : 'array'} outputs preserve original signing bytes`, async () => {
        const [Cardano, CardanoMessage] = await modules;
        const load = loadSdk(format, Cardano, CardanoMessage);
        const data = fixture(Cardano, { tagged, map });
        const { convertCborTxToEncodeTx } = load(
          'utils/onekey/dapp.js',
        ).dAppUtils;
        const { signTransaction } = load('utils/onekey/signTx.js');
        const { signTransaction: hardwareSign } = load('utils/trezor/sign.js');
        const { txToOneKey } = load('utils/onekey/txToOneKey.js');
        const { hasSetTagWithBody } = load('utils/onekey/hasSetTag.js');
        for (const txHex of [data.tx, data.body]) {
          const encoded = await convertCborTxToEncodeTx({
            txHex,
            utxos: data.utxos,
            addresses: [data.address],
            changeAddress: data.changeAddress,
            isSignOnly: true,
          });
          assert.equal(encoded.tx.body, data.body);
          assert.equal(encoded.tx.hash, data.fixed.transaction_hash().to_hex());
          const wrapped = Cardano.FixedTransaction.from_hex(
            encoded.tx.rawTxHex,
          );
          assert.equal(
            Buffer.from(wrapped.raw_body()).toString('hex'),
            data.body,
          );
          if (txHex === data.tx) assert.equal(encoded.tx.rawTxHex, data.tx);
        }
        const signed = await signTransaction(
          data.body,
          data.address,
          0,
          data.utxos,
          data.root.to_bech32(),
          true,
          false,
        );
        const witness = Cardano.TransactionWitnessSet.from_hex(signed.signedTx)
          .vkeys()
          .get(0);
        assert.ok(
          witness
            .vkey()
            .public_key()
            .verify(
              data.fixed.transaction_hash().to_bytes(),
              witness.signature(),
            ),
        );
        const canonical = Cardano.FixedTransactionBody.from_bytes(
          data.fixed.body().to_bytes(),
        ).tx_hash();
        if (canonical.to_hex() !== data.fixed.transaction_hash().to_hex()) {
          assert.equal(
            witness
              .vkey()
              .public_key()
              .verify(canonical.to_bytes(), witness.signature()),
            false,
          );
        }
        const full = await signTransaction(
          data.body,
          data.address,
          0,
          data.utxos,
          data.root.to_bech32(),
          false,
          false,
        );
        assert.equal(
          Buffer.from(
            Cardano.FixedTransaction.from_hex(full.signedTx).raw_body(),
          ).toString('hex'),
          data.body,
        );
        assert.equal(full.txid, data.fixed.transaction_hash().to_hex());
        assert.equal(await hasSetTagWithBody(data.body), tagged);
        const params = await txToOneKey(
          data.tx,
          1,
          { payment: {}, stake: {} },
          data.account.to_public().to_hex(),
          data.changeAddress,
        );
        assert.equal(params.tagCborSets, tagged);
        assert.equal(params.outputs[0].format, map ? 1 : 0);
        const deviceWitness = hardwareWitness(
          Cardano,
          data.fixed.transaction_hash(),
          data.payment,
        );
        const hardwareTx = await hardwareSign(data.body, [deviceWitness], {
          signOnly: false,
        });
        assert.equal(
          Buffer.from(
            Cardano.FixedTransaction.from_hex(hardwareTx).raw_body(),
          ).toString('hex'),
          data.body,
        );
        const hardwareSet = await hardwareSign(data.body, [deviceWitness], {
          signOnly: true,
        });
        const hardwareVkey = Cardano.TransactionWitnessSet.from_hex(hardwareSet)
          .vkeys()
          .get(0);
        assert.ok(
          hardwareVkey
            .vkey()
            .public_key()
            .verify(
              data.fixed.transaction_hash().to_bytes(),
              hardwareVkey.signature(),
            ),
        );
      });
    }
  }
  test(`${format}: reject hardware witnesses for re-encoded bodies`, async () => {
    const [Cardano, CardanoMessage] = await modules;
    const load = loadSdk(format, Cardano, CardanoMessage);
    const data = fixture(Cardano);
    const canonical = Cardano.FixedTransactionBody.from_bytes(
      data.fixed.body().to_bytes(),
    ).tx_hash();
    assert.notEqual(canonical.to_hex(), data.fixed.transaction_hash().to_hex());
    const witness = hardwareWitness(Cardano, canonical, data.payment);
    const { signTransaction } = load('utils/trezor/sign.js');
    for (const signOnly of [false, true]) {
      await assert.rejects(
        async () => signTransaction(data.body, [witness], { signOnly }),
        { code: 1 },
      );
    }
  });
  test(`${format}: hardware set tags come from the body, not existing witnesses`, async () => {
    const [Cardano, CardanoMessage] = await modules;
    const load = loadSdk(format, Cardano, CardanoMessage);
    const data = fixture(Cardano);
    const witnesses = Cardano.TransactionWitnessSet.new();
    const vkeys = Cardano.Vkeywitnesses.new();
    vkeys.add(
      Cardano.make_vkey_witness(data.fixed.transaction_hash(), data.payment),
    );
    witnesses.set_vkeys(vkeys);
    const mixed = Cardano.FixedTransaction.new(
      data.fixed.raw_body(),
      witnesses.to_bytes(),
      true,
    );
    assert.equal(
      Cardano.has_transaction_set_tag(mixed.to_bytes()),
      Cardano.TransactionSetsState.MixedSets,
    );
    const { txToOneKey } = load('utils/onekey/txToOneKey.js');
    const params = await txToOneKey(
      mixed.to_hex(),
      1,
      { payment: {}, stake: {} },
      data.account.to_public().to_hex(),
      data.changeAddress,
    );
    assert.equal(params.tagCborSets, false);
  });
  test(`${format}: preserve partialSign ownership checks`, async () => {
    const [Cardano, CardanoMessage] = await modules;
    const load = loadSdk(format, Cardano, CardanoMessage);
    const data = fixture(Cardano, { foreign: true });
    const { signTransaction } = load('utils/onekey/signTx.js');
    const args = [
      data.body,
      data.address,
      0,
      data.utxos,
      data.root.to_bech32(),
      true,
    ];
    await assert.rejects(() => signTransaction(...args, false), { code: 1 });
    const signed = await signTransaction(...args, true);
    const vkeys = Cardano.TransactionWitnessSet.from_hex(
      signed.signedTx,
    ).vkeys();
    assert.equal(vkeys.len(), 1);
    const witness = vkeys.get(0);
    assert.ok(
      witness
        .vkey()
        .public_key()
        .verify(data.fixed.transaction_hash().to_bytes(), witness.signature()),
    );
  });
  test(`${format}: preserve stake-key required signer selection`, async () => {
    const [Cardano, CardanoMessage] = await modules;
    const load = loadSdk(format, Cardano, CardanoMessage);
    const data = fixture(Cardano);
    const stake = data.account.derive(2).derive(0).to_raw_key();
    const body = `${data.body.replace(/^a3/, 'a4')}0e81581c${stake.to_public().hash().to_hex()}`;
    const hash = Cardano.FixedTransactionBody.from_hex(body).tx_hash();
    const { signTransaction } = load('utils/onekey/signTx.js');
    const signed = await signTransaction(
      body,
      data.address,
      0,
      data.utxos,
      data.root.to_bech32(),
      true,
      false,
    );
    const witnesses = Cardano.TransactionWitnessSet.from_hex(
      signed.signedTx,
    ).vkeys();
    assert.equal(witnesses.len(), 2);
    const expectedKeys = new Set([
      data.payment.to_public().to_hex(),
      stake.to_public().to_hex(),
    ]);
    for (let i = 0; i < witnesses.len(); i += 1) {
      const witness = witnesses.get(i);
      assert.ok(expectedKeys.delete(witness.vkey().public_key().to_hex()));
      assert.ok(
        witness
          .vkey()
          .public_key()
          .verify(hash.to_bytes(), witness.signature()),
      );
    }
    assert.equal(expectedKeys.size, 0);
  });
}
