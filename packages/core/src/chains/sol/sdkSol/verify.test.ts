import { verifySolSignedTxMatched } from './verify';

// yarn jest packages/core/src/chains/sol/sdkSol/verify.test.ts

const signerAddress = 'GWt2DhskeyYAWMFHmgPSbt4uwJLt5wgNXtiRLrqsQtCc';
const rawTx =
  'AVqw/wSKAEte7K9ed5xHN3Wdr+8jJ3JcocP4i8lAWkRoe/tcfUR3phOod1goTfyTyiFSYB87zukJ23epRqgasgABAAMG5obWRh+NpeMzvQjGBD0r8adxAKbh0DOiloDvnR0EHUV38sC/NOcQNN9VE9wwLvq8LiviqJeft/icTDtBHw7AhOh36nXWGvqGzrSyOru/coazx4tUGAiTnG2IeiDal6ViAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAADG+nrzvtutOj1l82qryXQxsbvkwtL24OR8pgIDRS9dYQbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpVnDZg3i+7vcSzHajJFWiDK/gQdl906FBMotymw4BOb0CAwAJA0BLTAAAAAAABQQCBAEACgwQJwAAAAAAAAY=';
const txid =
  '2pAeJTwRFEFdiNKvr4twinXz97NnmnEUyJYe9uafAyUBAWevnv418ozZYxwQTY5RhP7xvXScXcLXT51XTTrcyHfM';
const encoding = 'base64';

describe('verifySolSignedTxMatched', () => {
  it('should verify transaction successfully', () => {
    expect(() =>
      verifySolSignedTxMatched({ signerAddress, rawTx, txid, encoding }),
    ).not.toThrow();
  });

  it('should throw when txid not match', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress,
        rawTx,
        txid: '1111',
        encoding,
      }),
    ).toThrow(/^Solana txid not match/);
  });

  it('should throw when signer address not match', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress: '11111111111111111111111111111111',
        rawTx,
        txid,
        encoding,
      }),
    ).toThrow(/^Solana fee payer address not match/);
  });

  it('should throw when txid is empty', () => {
    expect(() =>
      verifySolSignedTxMatched({ signerAddress, rawTx, txid: '', encoding }),
    ).toThrow(/^Solana txid not match/);
  });

  it('should throw when signer address is empty', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress: '',
        rawTx,
        txid,
        encoding,
      }),
    ).toThrow(/^Solana fee payer address not match/);
  });

  // error handling ----------------------------------------------
  it('should throw on invalid raw tx format', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress,
        rawTx: 'invalid_raw_tx',
        txid,
        encoding,
      }),
    ).toThrow();
  });

  it('should throw on empty raw tx', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress,
        rawTx: '',
        txid,
        encoding,
      }),
    ).toThrow();
  });

  it('should throw on malformed JSON raw tx', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress,
        rawTx: '{invalid_json',
        txid,
        encoding,
      }),
    ).toThrow();
  });

  it('should throw on invalid base64 raw tx', () => {
    expect(() =>
      verifySolSignedTxMatched({
        signerAddress,
        rawTx: '"invalid_base64"',
        txid,
        encoding,
      }),
    ).toThrow();
  });
});
