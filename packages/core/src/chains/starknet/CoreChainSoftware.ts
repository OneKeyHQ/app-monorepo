import { merge } from 'lodash';

import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { batchGetPrivateKeys, decryptAsync, encryptAsync } from '../../secret';
import {
  ECoreApiExportedSecretKeyType,
  ECoreCredentialType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiGetExportedSecretKey,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';
import { slicePathTemplate } from '../../utils';

import sdkStarknet from './sdkStarknet';
import sdkStarknetViewingKey from './sdkStarknet/viewingKey';

import type { IStarknetAccountContract } from './sdkStarknet';
import type { IStrk20ViewingKeyResult } from './sdkStarknet/viewingKey';
import type {
  IEncodedTxStarknet,
  IStarknetRawDeployAccountTx,
  IStarknetRawTx,
  IStarknetSignature,
  IStarknetSignedDeployAccount,
  IStarknetSignedInvoke,
  IStrk20ProofInvocationPayload,
} from './types';
import type { IUnsignedMessageStarknet } from '../../types/coreTypesMessage';

// HD keys derive on secp256k1, then grind into the Stark curve order
const curve: ICurveName = 'secp256k1';

const getAccountContract = sdkStarknet.getAccountContractByEncoding;

// Argent X and OKX seed BIP32 with the Ethereum account key; they differ only
// in how they treat that key's leading zero bytes
function deriveEthereumSeededStarkKey(
  accountContract: IStarknetAccountContract,
  seedKey: Buffer,
  path: string,
): string {
  return accountContract === 'okx'
    ? sdkStarknet.deriveOkxStarkPrivateKey(seedKey, path)
    : sdkStarknet.deriveArgentStarkPrivateKey(seedKey, path);
}

const ETHEREUM_SEEDED_CONTRACTS = new Set<IStarknetAccountContract>([
  'argent',
  'okx',
]);

export default class CoreChainSoftware extends CoreChainApiBase {
  private async getStarkPrivateKeyFromPayload(
    payload: ICoreApiSignBasePayload,
  ): Promise<string> {
    const signer = await this.baseGetSingleSigner({ payload, curve });
    const rawPrivateKey = await signer.getPrvkey();
    if (!rawPrivateKey) {
      throw new OneKeyLocalError('Unable to get raw private key.');
    }
    return sdkStarknet.normalizeStarkPrivateKey(rawPrivateKey);
  }

  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const { keyType, password } = query;

    if (keyType !== ECoreApiExportedSecretKeyType.privateKey) {
      throw new OneKeyLocalError(`SecretKey type not support: ${keyType}`);
    }

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);
    if (!privateKeyRaw) {
      throw new OneKeyLocalError('privateKeyRaw is required');
    }

    const rawPrivateKey = await decryptAsync({
      password,
      data: privateKeyRaw,
      kdfBackend: query.kdfBackend,
      enablePbkdf2Cache: query.enablePbkdf2Cache,
    });
    try {
      // wallets import a zero-padded Stark private key
      return sdkStarknet.normalizeStarkPrivateKey(rawPrivateKey);
    } finally {
      rawPrivateKey.fill(0);
    }
  }

  // Returns Stark private keys, matching getExportedSecretKey; imported
  // credentials already hold one, HD child keys are ground here.
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    const credentialType = this.baseGetCredentialsType({
      credentials: payload.credentials,
    });
    if (
      credentialType === ECoreCredentialType.hd &&
      ETHEREUM_SEEDED_CONTRACTS.has(getAccountContract(payload.addressEncoding))
    ) {
      return this.getEthereumSeededHdPrivateKeys(payload);
    }
    const privateKeys = await this.baseGetPrivateKeys({ payload, curve });
    if (credentialType !== ECoreCredentialType.hd) {
      return privateKeys;
    }
    const { password, kdfBackend, enablePbkdf2Cache } = payload;
    const entries = await Promise.all(
      Object.entries(privateKeys).map(async ([path, encryptedChildKey]) => {
        const childPrivateKey = await decryptAsync({
          password,
          data: encryptedChildKey,
          kdfBackend,
          enablePbkdf2Cache,
        });
        let starkKey: string;
        try {
          starkKey = sdkStarknet.grindStarkPrivateKey(childPrivateKey);
        } finally {
          childPrivateKey.fill(0);
        }
        const encryptedStarkKey = bufferUtils.bytesToHex(
          await encryptAsync({
            password,
            data: bufferUtils.toBuffer(starkKey),
            kdfBackend,
            enablePbkdf2Cache,
          }),
        );
        return [path, encryptedStarkKey] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  // The Ethereum account key Argent X and OKX seed BIP32 with. Plaintext: callers use
  // it for one derivation and drop it.
  private async getEthereumSeedKey(params: {
    hdCredential: ICoreApiGetAddressesQueryHd['hdCredential'];
    password: string;
    hdCredentialCacheScopeId?: string;
    kdfBackend?: ICoreApiSignBasePayload['kdfBackend'];
    enablePbkdf2Cache?: boolean;
  }): Promise<Buffer> {
    const { password, kdfBackend, enablePbkdf2Cache } = params;
    const separator = sdkStarknet.ARGENT_SEED_KEY_PATH.lastIndexOf('/');
    const [info] = await batchGetPrivateKeys(
      curve,
      params.hdCredential,
      password,
      sdkStarknet.ARGENT_SEED_KEY_PATH.slice(0, separator),
      [sdkStarknet.ARGENT_SEED_KEY_PATH.slice(separator + 1)],
      params.hdCredentialCacheScopeId,
      kdfBackend,
      enablePbkdf2Cache,
    );
    if (!info) {
      throw new OneKeyInternalError('Unable to get private key.');
    }
    return decryptAsync({
      password,
      data: info.extendedKey.key,
      kdfBackend,
      enablePbkdf2Cache,
    });
  }

  private async getEthereumSeededHdPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    const { password, kdfBackend, enablePbkdf2Cache, account } = payload;
    const seedKey = await this.getEthereumSeedKey({
      hdCredential: checkIsDefined(payload.credentials.hd),
      password,
      kdfBackend,
      enablePbkdf2Cache,
    });
    let starkPrivateKey: string;
    try {
      starkPrivateKey = deriveEthereumSeededStarkKey(
        getAccountContract(payload.addressEncoding),
        seedKey,
        account.path,
      );
    } finally {
      seedKey.fill(0);
    }
    const encryptedStarkKey = bufferUtils.bytesToHex(
      await encryptAsync({
        password,
        data: bufferUtils.toBuffer(starkPrivateKey),
        kdfBackend,
        enablePbkdf2Cache,
      }),
    );
    return { [account.path]: encryptedStarkKey };
  }

  private signDeployment(
    encodedTx: IEncodedTxStarknet,
    starkPrivateKey: string,
  ): Pick<
    IStarknetRawDeployAccountTx,
    'deployAccount' | 'deployAccountTxHash'
  > {
    const deployAccount = checkIsDefined(encodedTx.deployAccount);
    const deployAccountTxHash = sdkStarknet.calculateDeployAccountTxHash({
      contractAddress: encodedTx.from,
      classHash: deployAccount.classHash,
      constructorCalldata: deployAccount.constructorCalldata,
      addressSalt: deployAccount.addressSalt,
      version: encodedTx.version,
      chainId: encodedTx.chainId,
      nonce: deployAccount.nonce,
      nonceDataAvailabilityMode: encodedTx.nonceDataAvailabilityMode,
      feeDataAvailabilityMode: encodedTx.feeDataAvailabilityMode,
      resourceBounds: deployAccount.resourceBounds,
      tip: encodedTx.tip,
      paymasterData: encodedTx.paymasterData,
    });
    const signedDeployAccount: IStarknetSignedDeployAccount = {
      type: 'DEPLOY_ACCOUNT',
      version: encodedTx.version,
      class_hash: sdkStarknet.toFelt(deployAccount.classHash),
      contract_address_salt: sdkStarknet.toFelt(deployAccount.addressSalt),
      constructor_calldata: sdkStarknet.toFeltArray(
        deployAccount.constructorCalldata,
      ),
      signature: sdkStarknet.signHash(deployAccountTxHash, starkPrivateKey),
      nonce: sdkStarknet.toFelt(deployAccount.nonce),
      resource_bounds: sdkStarknet.toRpcResourceBounds(
        deployAccount.resourceBounds,
      ),
      tip: sdkStarknet.toFelt(encodedTx.tip),
      paymaster_data: sdkStarknet.toFeltArray(encodedTx.paymasterData),
      nonce_data_availability_mode: encodedTx.nonceDataAvailabilityMode,
      fee_data_availability_mode: encodedTx.feeDataAvailabilityMode,
    };
    return { deployAccount: signedDeployAccount, deployAccountTxHash };
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, networkInfo, account } = payload;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStarknet;
    if (
      !sdkStarknet.isSameStarknetChainId(
        encodedTx.chainId,
        networkInfo.chainId,
      ) ||
      sdkStarknet.normalizeAddress(encodedTx.from) !==
        sdkStarknet.normalizeAddress(account.address)
    ) {
      throw new OneKeyInternalError({
        key: ETranslations.send_verification_failure,
      });
    }
    const starkPrivateKey = await this.getStarkPrivateKeyFromPayload(payload);

    if (encodedTx.type === 'DEPLOY_ACCOUNT') {
      if (encodedTx.calls.length || encodedTx.privacy) {
        throw new OneKeyLocalError(
          'Starknet: invalid account activation transaction',
        );
      }
      const rawTx: IStarknetRawDeployAccountTx = {
        type: 'DEPLOY_ACCOUNT',
        ...this.signDeployment(encodedTx, starkPrivateKey),
      };
      return {
        encodedTx,
        txid: rawTx.deployAccountTxHash,
        rawTx: stringUtils.stableStringify(rawTx),
      };
    }

    const { txHash: invokeTxHash, compiledCalldata } =
      sdkStarknet.calculateInvokeTxHash({
        senderAddress: encodedTx.from,
        version: encodedTx.version,
        calls: encodedTx.calls,
        chainId: encodedTx.chainId,
        nonce: encodedTx.nonce,
        accountDeploymentData: encodedTx.accountDeploymentData,
        nonceDataAvailabilityMode: encodedTx.nonceDataAvailabilityMode,
        feeDataAvailabilityMode: encodedTx.feeDataAvailabilityMode,
        resourceBounds: encodedTx.resourceBounds,
        tip: encodedTx.tip,
        paymasterData: encodedTx.paymasterData,
        proofFacts: encodedTx.privacy?.proofFacts,
      });

    // hashes above are computed from the raw values; everything below is the
    // RPC-ready form, so felts are converted and the hashes are unaffected
    const invoke: IStarknetSignedInvoke = {
      type: 'INVOKE',
      version: encodedTx.version,
      sender_address: sdkStarknet.toFelt(encodedTx.from),
      calldata: sdkStarknet.toFeltArray(compiledCalldata),
      signature: sdkStarknet.signHash(invokeTxHash, starkPrivateKey),
      nonce: sdkStarknet.toFelt(encodedTx.nonce),
      resource_bounds: sdkStarknet.toRpcResourceBounds(
        encodedTx.resourceBounds,
      ),
      tip: sdkStarknet.toFelt(encodedTx.tip),
      paymaster_data: sdkStarknet.toFeltArray(encodedTx.paymasterData),
      account_deployment_data: sdkStarknet.toFeltArray(
        encodedTx.accountDeploymentData,
      ),
      nonce_data_availability_mode: encodedTx.nonceDataAvailabilityMode,
      fee_data_availability_mode: encodedTx.feeDataAvailabilityMode,
      ...(encodedTx.privacy?.proofFacts?.length
        ? {
            proof_facts: sdkStarknet.toFeltArray(encodedTx.privacy.proofFacts),
          }
        : {}),
    };

    const rawTxPayload: IStarknetRawTx = { invoke, invokeTxHash };
    if (encodedTx.privacy) {
      // not hashed, so it travels beside the invoke rather than inside it
      rawTxPayload.proof = encodedTx.privacy.proof;
    }

    if (encodedTx.deployAccount) {
      Object.assign(
        rawTxPayload,
        this.signDeployment(encodedTx, starkPrivateKey),
      );
    }

    return {
      encodedTx: unsignedTx.encodedTx,
      txid: invokeTxHash,
      rawTx: stringUtils.stableStringify(rawTxPayload),
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageStarknet;
    const starkPrivateKey = await this.getStarkPrivateKeyFromPayload(payload);

    const messageHash = sdkStarknet.getTypedDataMessageHash({
      message: unsignedMsg.message,
      address: payload.account.address,
    });

    return stringUtils.stableStringify(
      sdkStarknet.signHash(messageHash, starkPrivateKey),
    );
  }

  /**
   * The single signature the STRK20 SDK asks for. Deliberately not
   * `signTransaction` with a synthetic encodedTx: that returns a whole
   * IStarknetRawTx whose invoke would look ready to broadcast with the pool as
   * sender, inviting someone downstream to submit it.
   */
  async signStrk20ProofInvocation(
    payload: ICoreApiSignBasePayload & {
      invocation: IStrk20ProofInvocationPayload;
    },
  ): Promise<IStarknetSignature> {
    const { invocation } = payload;
    if (
      sdkStarknet.normalizeAddress(invocation.poolAddress) ===
      sdkStarknet.normalizeAddress(payload.account.address)
    ) {
      throw new OneKeyLocalError(
        'Starknet: proof invocation sender must not be the account address',
      );
    }
    const starkPrivateKey = await this.getStarkPrivateKeyFromPayload(payload);

    const { txHash } = sdkStarknet.calculateInvokeTxHash({
      // the pool is the sender; it checks this signature via SNIP-6
      senderAddress: invocation.poolAddress,
      version: invocation.version,
      calls: invocation.calls,
      chainId: invocation.chainId,
      nonce: invocation.nonce,
      accountDeploymentData: invocation.accountDeploymentData,
      nonceDataAvailabilityMode: invocation.nonceDataAvailabilityMode,
      feeDataAvailabilityMode: invocation.feeDataAvailabilityMode,
      resourceBounds: invocation.resourceBounds,
      tip: invocation.tip,
      paymasterData: invocation.paymasterData,
    });

    const hashToSign =
      getAccountContract(payload.addressEncoding) === 'okx'
        ? sdkStarknet.getOkxSignatureMessageHash({
            hash: txHash,
            chainId: invocation.chainId,
            address: payload.account.address,
          })
        : txHash;

    return sdkStarknet.signHash(hashToSign, starkPrivateKey);
  }

  // STRK20 `account-leaf-v1`: reuses the account signer's Stark private key, so
  // it must resolve that key exactly the way signTransaction does. Starknet
  // scoped on purpose; the result is secret and must stay inside kit-bg.
  async deriveStrk20ViewingKey(
    payload: ICoreApiSignBasePayload & {
      chainId: string;
      accountAddress: string;
      poolAddress: string;
      keyIndex?: number;
    },
  ): Promise<IStrk20ViewingKeyResult> {
    const starkPrivateKey = await this.getStarkPrivateKeyFromPayload(payload);
    return sdkStarknetViewingKey.deriveStrk20ViewingKey({
      accountLeafPrivateKey: starkPrivateKey,
      chainId: payload.chainId,
      accountAddress: payload.accountAddress,
      poolAddress: payload.poolAddress,
      keyIndex: payload.keyIndex,
    });
  }

  /** privateKeyRaw is always a Stark private key here, never a secp256k1 one. */
  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const starkPrivateKey = sdkStarknet.normalizeStarkPrivateKey(
      query.privateKeyRaw,
    );
    return this.getAddressFromPublic({
      publicKey: sdkStarknet.getStarkPublicKey(starkPrivateKey),
      networkInfo: query.networkInfo,
      addressEncoding:
        'addressEncoding' in query ? query.addressEncoding : undefined,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey, addressEncoding } = query;
    return Promise.resolve({
      address: sdkStarknet.getAddressFromStarkPublicKey(
        publicKey,
        getAccountContract(addressEncoding),
      ),
      publicKey,
      __hwExtraInfo__: undefined,
    });
  }

  // Derived explicitly: the Stark key is a hash of the secp256k1 child key,
  // so it is reachable from neither the child public key nor a plain pubkey.
  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const {
      template,
      hdCredential,
      password,
      indexes,
      hdCredentialCacheScopeId,
      kdfBackend,
      enablePbkdf2Cache,
      addressEncoding,
    } = query;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const indexFormatted = indexes.map((index) =>
      pathSuffix.replace('{index}', index.toString()),
    );

    const accountContract = getAccountContract(addressEncoding);
    if (ETHEREUM_SEEDED_CONTRACTS.has(accountContract)) {
      const seedKey = await this.getEthereumSeedKey({
        hdCredential,
        password,
        hdCredentialCacheScopeId,
        kdfBackend,
        enablePbkdf2Cache,
      });
      try {
        const seededAddresses = await Promise.all(
          indexFormatted.map(async (suffix) => {
            const path = `${pathPrefix}/${suffix}`;
            const publicKey = sdkStarknet.getStarkPublicKey(
              deriveEthereumSeededStarkKey(accountContract, seedKey, path),
            );
            const result = await this.getAddressFromPublic({
              publicKey,
              networkInfo: query.networkInfo,
              addressEncoding,
            });
            return merge({ publicKey, path }, result);
          }),
        );
        return { addresses: seededAddresses };
      } finally {
        seedKey.fill(0);
      }
    }

    const privateKeyInfos = await batchGetPrivateKeys(
      curve,
      hdCredential,
      password,
      pathPrefix,
      indexFormatted,
      hdCredentialCacheScopeId,
      kdfBackend,
      enablePbkdf2Cache,
    );
    if (privateKeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get private key.');
    }

    const addresses = await Promise.all(
      privateKeyInfos.map(async (info) => {
        const {
          path,
          extendedKey: { key },
        } = info;
        const childPrivateKey = await decryptAsync({
          password,
          data: key,
          kdfBackend,
          enablePbkdf2Cache,
        });
        let starkPrivateKey: string;
        try {
          starkPrivateKey = sdkStarknet.grindStarkPrivateKey(childPrivateKey);
        } finally {
          childPrivateKey.fill(0);
        }
        const publicKey = sdkStarknet.getStarkPublicKey(starkPrivateKey);
        const result = await this.getAddressFromPublic({
          publicKey,
          networkInfo: query.networkInfo,
          addressEncoding,
        });
        return merge({ publicKey, path }, result);
      }),
    );
    return { addresses };
  }
}
