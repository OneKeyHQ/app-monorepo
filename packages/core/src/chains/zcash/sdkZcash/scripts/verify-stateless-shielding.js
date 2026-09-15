/* eslint-disable no-console */
/* eslint-disable onekey/no-raw-error -- standalone offline verification */
// Exercises the installed WASM with public synthetic test inputs. No network,
// wallet initialization, storage, scanning, or broadcast is performed.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const bs58check = require('bs58check');

async function load(packageName, stem) {
  const directory = path.dirname(
    require.resolve(`${packageName}/package.json`),
  );
  const module = await import(path.join(directory, `${stem}.js`));
  await module.default({
    module_or_path: fs.readFileSync(path.join(directory, `${stem}_bg.wasm`)),
  });
  return module;
}

async function main() {
  const keys = await load('onekey-zcash-keys', 'onekey_zcash_keys');
  const runtime = await load('onekey-zcash-runtime', 'onekey_zcash_runtime');
  const seed = new Uint8Array(32).fill(7);
  let original;
  let proved;
  let signed;
  try {
    const ufvk = keys.ufvkFromSeed('main', seed, 0);
    const recipient = keys.unifiedAddress('main', ufvk, 'orchard');
    const transparent = keys.transparentAddressFromUfvk('main', ufvk);
    const hash = Buffer.from(bs58check.decode(transparent))
      .subarray(2)
      .toString('hex');
    const outpoint = { txid: '11'.repeat(32), vout: 0 };
    const request = {
      network: 'main',
      accountIndex: 0,
      targetHeight: 3_500_000,
      expiryHeight: 3_500_020,
      utxos: [
        {
          ...outpoint,
          valueZat: '100000',
          scriptPubKey: `76a914${hash}88ac`,
          isCoinbase: false,
          confirmations: 1,
          derivationPath: "m/44'/133'/0'/0/0",
        },
      ],
      selectedOutpoints: [outpoint],
      recipients: [{ address: recipient }],
      sendMax: true,
    };
    const requestJson = JSON.stringify(request);
    const quote = JSON.parse(keys.transparentTxQuote(requestJson));
    assert.equal(quote.feeZat, '15000');
    assert.equal(quote.sendAmountZat, '85000');
    original = keys.transparentShieldCreateWithSeed(requestJson, seed);
    proved = runtime.pcztProveAtHeight(request.targetHeight, original);
    signed = keys.transparentShieldSignWithSeed(
      requestJson,
      seed,
      original,
      proved,
    );
    const built = JSON.parse(runtime.pcztExtractStateless(signed));
    assert.match(built.txid, /^[0-9a-f]{64}$/);
    assert.match(built.rawTx, /^[0-9a-f]+$/);
    const changed = JSON.stringify({
      ...request,
      expiryHeight: request.expiryHeight + 1,
    });
    assert.throws(() =>
      keys.transparentShieldSignWithSeed(changed, seed, original, proved),
    );
    console.log(
      'PASS: installed WASM quotes, creates, proves, signs and verifies shielding without wallet/storage/scan; changed request rejected.',
    );
    const payload = Buffer.alloc(78);
    payload.writeUInt32BE(0x04_88_b2_1e, 0);
    payload[4] = 3;
    payload.writeUInt32BE(0x80_00_00_00, 9);
    Buffer.from(
      keys.transparentAccountPubKeyFromUfvk('main', ufvk),
      'hex',
    ).copy(payload, 13);
    const accountXpub = bs58check.encode(payload);
    for (const address of [transparent, recipient]) {
      for (const sendMax of [false, true]) {
        const hardwareRequest = {
          ...request,
          recipients: [{ address }],
          sendMax: true,
        };
        const hardwareQuote = JSON.parse(
          keys.transparentTxQuote(JSON.stringify(hardwareRequest)),
        );
        if (!sendMax) {
          hardwareRequest.sendMax = false;
          hardwareRequest.recipients[0].amountZat = hardwareQuote.sendAmountZat;
        }
        const approved = JSON.stringify(hardwareRequest);
        const hardwareOriginal = keys.transparentTxCreateWithAccountXpub(
          approved,
          accountXpub,
          keys.seedFingerprint(seed),
        );
        // Synthetic software signer models device signatures; native tests separately cover redaction and device metadata.
        const deviceSigned = keys.pcztSignWithSeed(
          'main',
          seed,
          0,
          hardwareOriginal,
        );
        let combined;
        let hardwareProved;
        try {
          combined = keys.transparentTxCombineHardwareSigned(
            approved,
            accountXpub,
            hardwareOriginal,
            deviceSigned,
          );
          hardwareProved = runtime.pcztProveAtHeight(
            request.targetHeight,
            combined,
          );
          const result = JSON.parse(
            runtime.pcztExtractStateless(hardwareProved),
          );
          assert.match(result.txid, /^[0-9a-f]{64}$/);
          assert.match(result.rawTx, /^[0-9a-f]+$/);
          console.log(
            `PASS: installed hardware path destination=${address.startsWith('u1') ? 'UA' : 'transparent'} max=${sendMax}, verified extraction.`,
          );
        } finally {
          hardwareOriginal.fill(0);
          deviceSigned.fill(0);
          combined?.fill(0);
          hardwareProved?.fill(0);
        }
      }
    }
  } finally {
    seed.fill(0);
    original?.fill(0);
    proved?.fill(0);
    signed?.fill(0);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Stateless shielding verification failed',
  );
  process.exitCode = 1;
});
