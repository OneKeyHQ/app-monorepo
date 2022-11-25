/* eslint-disable no-plusplus */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as CardanoWasm from '@emurgo/cardano-serialization-lib-asmjs';
import { coinSelection } from '@fivebinaries/coin-selection';
import BigNumber from 'bignumber.js';

import { IAdaAmount, IAdaUTXO } from '../../types';

type ITransferInfo = {
  from: string;
  to: string;
  amount: string;
  token?: string; // tokenIdOnNetwork
  isNFT?: boolean;
  tokenId?: string; // NFT token id
  type?: string; // NFT standard: erc721/erc1155
};

const {
  Address,
  TransactionBuilder,
  TransactionBuilderConfigBuilder,
  TransactionUnspentOutputs,
  TransactionUnspentOutput,
  TransactionInput,
  TransactionOutput,
  TransactionHash,
  TransactionWitnessSet,
  Transaction,
  Value,
  LinearFee,
  BigNum,
} = CardanoWasm;

type CoinSelectResult = ReturnType<typeof coinSelection>;

const composeTxPlan = (
  transferInfo: ITransferInfo,
  accountXpub: string,
  utxos: IAdaUTXO[],
  changeAddress: string,
  outputs: { address: string; amount: string; assets: [] }[],
): CoinSelectResult => {
  const transformUtxos = utxos.map((utxo) => ({
    address: transferInfo.from,
    txHash: utxo.tx_hash,
    outputIndex: utxo.output_index,
    ...utxo,
  }));
  try {
    const txPlan = coinSelection(
      {
        utxos: transformUtxos as any,
        outputs: outputs as any,
        changeAddress,
        certificates: [],
        withdrawals: [],
        accountPubKey: accountXpub,
      },
      {
        debug: true,
      },
    );
    return txPlan;
  } catch (err: unknown) {
    if ((err as { code: string }).code === 'UTXO_BALANCE_INSUFFICIENT') {
      console.log('UTxO balance insufficient');
      if (outputs.length === 1) {
        const fixedOutput = [...outputs];
        const amountBN = new BigNumber(outputs[0].amount);
        const oneLovelace = new BigNumber('100000');
        if (amountBN.gte(oneLovelace)) {
          fixedOutput[0].amount = amountBN.minus(oneLovelace).toFixed();
          return composeTxPlan(
            transferInfo,
            accountXpub,
            utxos,
            changeAddress,
            fixedOutput,
          );
        }
      }
      throw err;
    } else {
      throw err;
    }
  }
};

const getPaymentHexAddress = (address: string) => {
  const paymentAddr = Buffer.from(
    Address.from_bech32(address).to_bytes() as any,
    'hex',
  ).toString('hex');
  return paymentAddr;
};

/**
 *
 * @param {string} amount - cbor value
 * @param {Object} paginate
 * @param {number} paginate.page
 * @param {number} paginate.limit
 * @returns
 */
const getUtxos = async (address: string, utxos: IAdaUTXO[]) => {
  const paymentAddr = getPaymentHexAddress(address);
  const converted = utxos.map((utxo) => utxoFromJson(utxo, paymentAddr));

  if (converted.length <= 0) {
    return null;
  }

  return Promise.resolve(converted);
};

/**
 *
 * @param {JSON} output
 * @param {BaseAddress} address
 * @returns
 */
const utxoFromJson = (output: IAdaUTXO, address: string) =>
  TransactionUnspentOutput.new(
    TransactionInput.new(
      TransactionHash.from_bytes(Buffer.from(output.tx_hash, 'hex')),
      Number(output.output_index),
    ),
    TransactionOutput.new(
      Address.from_bytes(Buffer.from(address, 'hex')),
      assetsToValue(output.amount),
    ),
  );

export const assetsToValue = (assets: IAdaAmount[]): CardanoWasm.Value => {
  const multiAsset = CardanoWasm.MultiAsset.new();
  const lovelace = assets.find((asset) => asset.unit === 'lovelace');
  const policies = [
    ...new Set(
      assets
        .filter((asset) => asset.unit !== 'lovelace')
        .map((asset) => asset.unit.slice(0, 56)),
    ),
  ];
  policies.forEach((policy) => {
    const policyAssets = assets.filter(
      (asset) => asset.unit.slice(0, 56) === policy,
    );
    const assetsValue = CardanoWasm.Assets.new();
    policyAssets.forEach((asset) => {
      assetsValue.insert(
        CardanoWasm.AssetName.new(Buffer.from(asset.unit.slice(56), 'hex')),
        BigNum.from_str(asset.quantity),
      );
    });
    multiAsset.insert(
      CardanoWasm.ScriptHash.from_bytes(Buffer.from(policy, 'hex')),
      assetsValue,
    );
  });
  const value = CardanoWasm.Value.new(
    BigNum.from_str(lovelace ? lovelace.quantity : '0'),
  );
  if (assets.length > 1 || !lovelace) {
    value.set_multiasset(multiAsset);
  }
  return value;
};
// const getUtxos = async (address: string, utxos: IAdaUTXO[]) => {
//   const address = getPaymentAddress(address);
// };

/**
 * Protocol parameters
 * @type {{
 * keyDeposit: string,
 * coinsPerUtxoWord: string,
 * minUtxo: string,
 * poolDeposit: string,
 * maxTxSize: number,
 * priceMem: number,
 * maxValSize: number,
 * linearFee: {minFeeB: string, minFeeA: string}, priceStep: number
 * }}
 */
const protocolParams = {
  linearFee: {
    minFeeA: '44',
    minFeeB: '155381',
  },
  minUtxo: '34482',
  poolDeposit: '500000000',
  keyDeposit: '2000000',
  maxValSize: 5000,
  maxTxSize: 16384,
  priceMem: 0.0577,
  priceStep: 0.0000721,
  coinsPerUtxoWord: '34482',
};

/**
 * Every transaction starts with initializing the
 * TransactionBuilder and setting the protocol parameters
 * This is boilerplate
 * @returns {Promise<TransactionBuilder>}
 */
const initTransactionBuilder = () => {
  const txBuilder = TransactionBuilder.new(
    TransactionBuilderConfigBuilder.new()
      .fee_algo(
        LinearFee.new(
          BigNum.from_str(protocolParams.linearFee.minFeeA),
          BigNum.from_str(protocolParams.linearFee.minFeeB),
        ),
      )
      .pool_deposit(BigNum.from_str(protocolParams.poolDeposit))
      .key_deposit(BigNum.from_str(protocolParams.keyDeposit))
      .coins_per_utxo_word(BigNum.from_str(protocolParams.coinsPerUtxoWord))
      .max_value_size(protocolParams.maxValSize)
      .max_tx_size(protocolParams.maxTxSize)
      .prefer_pure_change(true)
      .build(),
  );

  return txBuilder;
};

const buildSendADATransaction = async (
  transferInfo: ITransferInfo,
  utxos: IAdaUTXO[],
) => {
  console.log(transferInfo);

  const txBuilder = initTransactionBuilder();
  const shelleyOutputAddress = Address.from_bech32(transferInfo.to);
  const shelleyChangeAddress = Address.from_bech32(transferInfo.from);

  txBuilder.add_output(
    TransactionOutput.new(
      shelleyOutputAddress,
      Value.new(BigNum.from_str(transferInfo.amount)),
    ),
  );

  // Find the available UTXOs in the wallet and
  // us them as Inputs
  const txUnspentOutputs = await getTxUnspentOutputs(transferInfo.from, utxos);
  txBuilder.add_inputs_from(txUnspentOutputs, 1);

  // calculate the min fee required and send any change to an address
  txBuilder.add_change_if_needed(shelleyChangeAddress);
  // once the transaction is ready, we build it to get the tx body without witnesses
  const txBody = txBuilder.build();
  // Tx witness
  const transactionWitnessSet = TransactionWitnessSet.new();

  const tx = Transaction.new(
    txBody,
    TransactionWitnessSet.from_bytes(transactionWitnessSet.to_bytes()),
  );

  // will sign Transaction
  const txHex = Buffer.from(tx.to_bytes() as any, 'utf8').toString('hex');
  return txHex;
};

/**
 * Builds an object with all the UTXOs from the user's wallet
 * @returns {Promise<TransactionUnspentOutputs>}
 */
const getTxUnspentOutputs = async (address: string, utxos: IAdaUTXO[]) => {
  const Utxos = await formatUtxo(address, utxos);
  const txOutputs = TransactionUnspentOutputs.new();

  if (!Utxos) {
    return txOutputs;
  }

  for (const utxo of Utxos) {
    const u = utxo.TransactionUnspentOutput.input().to_json();
    console.log(u);
    txOutputs.add(utxo.TransactionUnspentOutput);
  }
  return txOutputs;
};

/**
 * Gets the UTXOs from the user's wallet and then
 * format as an object
 * @returns {Promise<void>}
 */
const formatUtxo = async (address: string, utxos: IAdaUTXO[]) => {
  const Utxos = [];

  try {
    const rawUtxos = await getUtxos(address, utxos);

    for (const rawUtxo of rawUtxos ?? []) {
      const utxo = rawUtxo;
      const input = utxo.input();
      const txid = Buffer.from(
        input.transaction_id().to_bytes() as any,
        'utf8',
      ).toString('hex');
      const txindex = input.index();
      const output = utxo.output();
      const amount = output.amount().coin().to_str(); // ADA amount in lovelace
      const multiasset = output.amount().multiasset();
      let multiAssetStr = '';

      if (multiasset) {
        const keys = multiasset.keys(); // policy Ids of thee multiasset
        const N = keys.len();
        console.log(`${N} Multiassets in the UTXO`);

        for (let i = 0; i < N; i++) {
          const policyId = keys.get(i);
          const policyIdHex = Buffer.from(
            policyId.to_bytes() as any,
            'utf8',
          ).toString('hex');
          console.log(`policyId: ${policyIdHex}`);
          const assets = multiasset.get(policyId);
          if (assets) {
            const assetNames = assets?.keys();
            const K = assetNames.len();
            console.log(`${K} Assets in the Multiasset`);
            for (let j = 0; j < K; j++) {
              const assetName = assetNames.get(j);
              const assetNameString = Buffer.from(
                assetName.name() as any,
                'utf8',
              ).toString();
              const assetNameHex = Buffer.from(
                assetName.name() as any,
                'utf8',
              ).toString('hex');
              const multiassetAmt = multiasset.get_asset(policyId, assetName);
              multiAssetStr += `+ ${multiassetAmt.to_str()} + ${policyIdHex}.${assetNameHex} (${assetNameString})`;
              console.log(assetNameString);
              console.log(`Asset Name: ${assetNameHex}`);
            }
          }
        }
      }

      const obj = {
        txid,
        txindx: txindex,
        amount,
        str: `${txid} #${txindex} = ${amount}`,
        multiAssetStr,
        TransactionUnspentOutput: utxo,
      };
      Utxos.push(obj);
    }

    return Utxos;
  } catch (err) {
    console.log(err);
  }
};

type ICardanoApi = {
  composeTxPlan: (
    transferInfo: ITransferInfo,
    accountXpub: string,
    utxos: IAdaUTXO[],
    changeAddress: string,
    outputs: {
      address: string;
      amount: string;
      assets: [];
    }[],
  ) => CoinSelectResult;

  buildSendADATransaction: (
    transferInfo: ITransferInfo,
    utxos: IAdaUTXO[],
  ) => Promise<string>;
};

const CardanoApi: ICardanoApi = {
  composeTxPlan,
  buildSendADATransaction,
};

export { CardanoApi };
