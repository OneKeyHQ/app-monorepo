import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

export const LiteFlag = {
  VERSION: '01',
  LANGUAGE: '00', // english
  TAG: 'ffff',
};

function entropyToMnemonic(entropy: string): Promise<string> {
  const wordlists = bip39.wordlists.english;
  const n = wordlists.length;

  const mnemonic = [];
  let entropyNumber = new BigNumber(entropy);
  let x = 0;
  while (entropyNumber.gt(0)) {
    x = entropyNumber.mod(n).integerValue().toNumber();
    // eslint-disable-next-line spellcheck/spell-checker
    entropyNumber = entropyNumber.idiv(n);

    mnemonic.push(wordlists[x]);
  }

  // v1 fix
  let fixFillCount = 0;
  const supportedMnemonicLength = [12, 15, 18, 21, 24];
  for (const len of supportedMnemonicLength) {
    if (mnemonic.length === len) {
      break;
    }
    if (mnemonic.length < len) {
      fixFillCount = len - mnemonic.length;
      break;
    }
  }

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < fixFillCount; i++) {
    mnemonic.push(wordlists[0]);
  }

  return Promise.resolve(mnemonic.join(' '));
}

function entropyToMnemonicV2(entropy: string): Promise<string> {
  return Promise.resolve(
    bip39.entropyToMnemonic(entropy, bip39.wordlists.english),
  );
}

function mnemonicToEntropy(mnemonic: string): Promise<string> {
  const wordlists = bip39.wordlists.english;
  const n = wordlists.length;
  const words = mnemonic.split(' ');
  let i = new BigNumber(0);
  while (words.length) {
    const w = words.pop();
    if (w) {
      const k = wordlists.indexOf(w);
      i = i.times(n).plus(k);
    }
  }
  return Promise.resolve(i.toFixed());
}

export async function encodeMnemonic(mnemonic: string): Promise<string> {
  const meta = LiteFlag.TAG + LiteFlag.VERSION + LiteFlag.LANGUAGE;
  const enMnemonic = await mnemonicToEntropy(mnemonic.trim()); // mnemonic to index
  return enMnemonic + meta;
}

export async function decodeMnemonic(payload: string) {
  try {
    if (payload.length <= 8)
      return Buffer.from(payload, 'hex').toString().trim();

    const meta = payload.slice(-8);

    const regexp = /^ffff[a-f0-9]{4}$/;
    if (regexp.test(meta)) {
      const version = parseInt(meta.slice(4, 6), 10);
      const enMnemonic = payload.slice(0, -8);

      if (version === 1) {
        const deMnemonic = await entropyToMnemonic(enMnemonic); // mnemonic to index

        return deMnemonic.trim();
      }

      if (version === 2) {
        const deMnemonic = await entropyToMnemonicV2(enMnemonic); // mnemonic to index

        return deMnemonic.trim();
      }

      // 当前版本不支持
      return '';
    }

    // 兼容 V0 旧版本
    return Buffer.from(payload, 'hex').toString().trim();
  } catch (error) {
    // 数据解析报错
    return '';
  }
}
