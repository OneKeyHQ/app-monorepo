import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import type { DBAccount } from '../../../../types/account';
import type { IUnsignedMessageBtc } from '../../../../types/message';
import type { KeyringSoftwareBase } from '../../../keyring/KeyringSoftwareBase';
import type {
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';
import type VaultBtcFork from '../VaultBtcFork';

async function getBtcRelPathToAddress({
  vault,
  addresses,
  options,
  account,
}: {
  vault: VaultBtcFork;
  addresses: string[];
  options: ISignCredentialOptions;
  account: DBAccount;
}) {
  // return this.baseSignTransactionByChainApiBtc(unsignedTx, options);

  const { utxos } = await vault.collectUTXOsInfo({ checkInscription: false });

  const pathToAddresses: {
    [path: string]: {
      address: string;
      relPath: string;
    };
  } = {};

  // add all addresses from utxos
  for (const utxo of utxos) {
    const { address, path } = utxo;
    if (addresses.includes(address)) {
      const relPath = path.split('/').slice(-2).join('/');
      pathToAddresses[path] = {
        address,
        relPath,
      };
    }
  }

  // always add first account address
  const firstRelPath = '0/0';
  const firstFullPath = [account.path, firstRelPath].join('/');
  if (!pathToAddresses[firstFullPath]) {
    pathToAddresses[firstFullPath] = {
      address: account.address,
      relPath: firstRelPath,
    };
  }

  const relPaths: string[] = Object.values(pathToAddresses).map(
    (item) => item.relPath,
  );

  return {
    relPaths,
    pathToAddresses,
  };
}

async function signMessageBtc(
  keyring: KeyringSoftwareBase,
  messages: IUnsignedMessageBtc[],
  options: ISignCredentialOptions,
): Promise<string[]> {
  if (!keyring.coreApi) {
    throw new Error('coreApi is not defined');
  }
  const { password } = options;
  const dbAccount = await keyring.getDbAccount();
  const vault = keyring.vault as VaultBtcFork;
  const networkInfo = await keyring.baseGetCoreApiNetworkInfo();
  const networkImpl = await keyring.getNetworkImpl();
  const addresses = [dbAccount.address];

  const {
    // required for multiple address signing
    relPaths,
    pathToAddresses,
  } = await getBtcRelPathToAddress({
    vault,
    addresses,
    options,
    account: dbAccount,
  });

  const credentials = await keyring.baseGetCredentialsInfo(options);
  const result = await Promise.all(
    messages.map((msg) =>
      checkIsDefined(keyring.coreApi).signMessage({
        unsignedMsg: msg,
        password,
        account: { ...dbAccount, relPaths },
        credentials,
        networkInfo,
        btcExtraInfo: {
          pathToAddresses,
        },
      }),
    ),
  );
  return result;
}

async function signTransactionBtc(
  keyring: KeyringSoftwareBase,
  unsignedTx: IUnsignedTxPro,
  options: ISignCredentialOptions,
): Promise<ISignedTxPro> {
  // return this.baseSignTransactionByChainApiBtc(unsignedTx, options);

  const { password } = options;
  const dbAccount = await keyring.getDbAccount();
  const chainCode = (await keyring.getChainInfo()).code;
  const vault = keyring.vault as VaultBtcFork;
  const provider = await vault.getProvider();
  const networkImpl = await keyring.getNetworkImpl();
  const networkInfo = await keyring.baseGetCoreApiNetworkInfo();

  const addresses = (unsignedTx.inputsToSign || unsignedTx.inputs).map(
    (input) => input.address,
  );

  const {
    // required for multiple address signing
    relPaths,
    pathToAddresses,
  } = await getBtcRelPathToAddress({
    vault,
    addresses,
    options,
    account: dbAccount,
  });

  const [inputAddressesEncodings, nonWitnessPrevTxs] =
    await provider.collectInfoForSoftwareSign(unsignedTx);

  const credentials = await keyring.baseGetCredentialsInfo(options);
  const tx = await checkIsDefined(keyring.coreApi).signTransaction({
    unsignedTx,
    password,
    account: { ...dbAccount, relPaths },
    credentials,
    networkInfo,
    btcExtraInfo: {
      pathToAddresses,
      inputAddressesEncodings,
      nonWitnessPrevTxs,
    },
  });

  return tx;
}

export default {
  signTransactionBtc,
  signMessageBtc,
};
