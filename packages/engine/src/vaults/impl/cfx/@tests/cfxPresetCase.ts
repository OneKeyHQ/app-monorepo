import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_CFX } from '@onekeyhq/shared/src/engine/engineConsts';

import { prepareMockVault } from '../../../../../@tests/prepareMockVault';
import { getAccountNameInfoByImpl } from '../../../../managers/impl';
import Vault from '../Vault';
import VaultHelper from '../VaultHelper';

import { decodeRaw, encodeAddress, verifySignature } from './utils';

import type { IPrepareMockVaultOptions } from '../../../../../@tests/types';
import type { KeyringBase } from '../../../keyring/KeyringBase';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type { IPrepareAccountsParams } from '../../../types';
import type { VaultBase } from '../../../VaultBase';

const cfxAccountNameInfo = getAccountNameInfoByImpl(IMPL_CFX);
const prepareAccountsParams = {
  indexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  coinType: cfxAccountNameInfo.default.coinType,
  template: cfxAccountNameInfo.default.template,
};

export async function testPrepareAccounts(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringBase;
  },
) {
  const { options, dbAccount, network } = prepareMockVault(prepareOptions);
  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);
  const keyring = builder.keyring({ vault });
  const accounts = await keyring.prepareAccounts({
    ...prepareAccountsParams,
    name: dbAccount.name,
    target: encodeAddress(dbAccount.address, network.id),
    accountIdPrefix: 'external',
    password: prepareOptions.password,
    privateKey: prepareOptions.privateKey
      ? Buffer.from(prepareOptions.privateKey, 'hex')
      : '',
  } as IPrepareAccountsParams);
  expect(accounts[0]).toEqual(dbAccount);
}

export async function testSignTransaction(
  prepareOptions: IPrepareMockVaultOptions,
  builder: {
    keyring: (payload: { vault: VaultBase }) => KeyringSoftwareBase;
  },
) {
  const { options, dbAccount, password, network } =
    prepareMockVault(prepareOptions);

  expect(password).toBeTruthy();

  const vault = new Vault(options);
  vault.helper = new VaultHelper(options);

  const keyring = builder.keyring({ vault });
  const netId = network.id;
  const fromCFXAddress = encodeAddress(dbAccount.address, netId);
  const toCFXAddress = encodeAddress(dbAccount.address, netId);

  const encodedTx = await vault.buildEncodedTxFromTransfer({
    from: fromCFXAddress,
    to: toCFXAddress,
    amount: '12',
    'token': '',
  });
  const feeInfoValue = {
    'eip1559': false,
    'price': '0.000000001',
    'limit': '21000',
  };

  const encodedTxWithFee = await vault.attachFeeInfoToEncodedTx({
    encodedTx,
    feeInfoValue,
  });
  const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTxWithFee);
  // 签名使用的是 elliptic
  const signedTx = await keyring.signTransaction(unsignedTx, {
    password,
  });
  const nativeTx = decodeRaw(signedTx.rawTx);
  const signers = await keyring.getSigners(password || '', [fromCFXAddress]);
  const signer = signers[fromCFXAddress];
  const rBytes = Buffer.from(nativeTx.r.slice(2) as string, 'hex');
  const sBytes = Buffer.from(nativeTx.s.slice(2) as string, 'hex');
  const signature = Buffer.concat([rBytes, sBytes]);
  const params = {
    publicKey: (await signer.getPubkey()).toString('hex'),
    digest: signedTx?.digest?.slice(2) || '',
    signature,
  };
  // TODO: signer.verifySignature needs to be implemented by secp256k1
  // const isVerified = signer.verifySignature(params);
  const isVerified = verifySignature(
    Buffer.from(params.digest, 'hex'),
    signature,
    await signer.getPubkey(),
  );
  expect(isVerified).toBeTruthy();
  await wait(1000);
}
