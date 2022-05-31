import { ethers } from '@onekeyfe/blockchain-libs';

import {
  EVMTxFromType,
  LogEvent,
  Transaction,
  Transfer,
} from '../../../../types/covalent';
import { Network } from '../../../../types/network';
import { Token } from '../../../../types/token';

import { EVMTxDecoder, InfiniteAmountText } from './decoder';
import { parseGasInfo } from './gasParser';
import { EVMDecodedInfoType, EVMDecodedItem, EVMDecodedTxType } from './types';

type ParseResult = {
  type: EVMDecodedTxType;
  info: EVMDecodedInfoType;
} | null;

type TypeParser = (covalentTx: Transaction) => ParseResult;

const parseToken = (log: LogEvent | Transfer, chainId: number): Token => {
  let senderAddress;
  let name;
  let symbol;
  let decimals;
  let logoURI;
  if ('senderName' in log) {
    senderAddress = log.senderAddress;
    name = log.senderName;
    symbol = log.senderContractTickerSymbol;
    decimals = log.senderContractDecimals;
    logoURI = log.senderLogoUrl;
  } else {
    senderAddress = log.fromAddress;
    name = log.contractName;
    symbol = log.contractTickerSymbol;
    decimals = log.contractDecimals;
    logoURI = log.logoUrl;
  }
  const networkId = `evm--${chainId}`;
  return {
    id: `${networkId}--${senderAddress}`,
    name,
    networkId,
    tokenIdOnNetwork: senderAddress,
    symbol,
    decimals,
    logoURI,
  };
};

const parseDecodedParams = (logEvent: LogEvent) => {
  const { params } = logEvent.decoded;
  return params.reduce((acc, cur) => {
    acc[cur.name] = cur.value;
    return acc;
  }, {} as Record<string, string>);
};

const paraseSpam: TypeParser = (covalentTx) => {
  const { logEvents } = covalentTx;
  // it probably is spam
  if (logEvents && logEvents.length > 100) {
    return { type: EVMDecodedTxType.TRANSACTION, info: null };
  }
  return null;
};

const paraseTokenTransferLog: TypeParser = (covalentTx) => {
  if (!covalentTx.transfers) {
    return null;
  }
  const tokenTx = covalentTx.transfers[0];
  const token = parseToken(tokenTx, covalentTx.chainId);
  const amount = EVMTxDecoder.formatValue(tokenTx.delta ?? '0', token.decimals);
  return {
    type: EVMDecodedTxType.TOKEN_TRANSFER,
    info: {
      type: EVMDecodedTxType.TOKEN_TRANSFER,
      token,
      amount,
      value: tokenTx.delta,
      recipient: tokenTx.toAddress,
    },
  };
};

const paraseNativeTransfer: TypeParser = (covalentTx) => {
  if (covalentTx.gasSpent === 21000) {
    return { type: EVMDecodedTxType.NATIVE_TRANSFER, info: null };
  }
  return null;
};

const paraseTokenInteraction: TypeParser = (covalentTx) => {
  const { logEvents } = covalentTx;
  if (!logEvents || !logEvents.length) {
    return null;
  }

  const event = logEvents.find((e) => !!e.decoded);
  if (!event) {
    return null;
  }

  const { name, params } = event.decoded;
  if (
    (name !== 'Transfer' && name !== 'Approval') ||
    !params ||
    params.length !== 3
  ) {
    return null;
  }

  const paramsMap = parseDecodedParams(event);
  const token = parseToken(event, covalentTx.chainId);
  const amount = EVMTxDecoder.formatValue(
    paramsMap.value ?? '0',
    token.decimals,
  );

  if (name === 'Transfer') {
    return {
      type: EVMDecodedTxType.TOKEN_TRANSFER,
      info: {
        type: EVMDecodedTxType.TOKEN_TRANSFER,
        token,
        amount,
        value: paramsMap.value,
        recipient: paramsMap.to,
      },
    };
  }

  return {
    type: EVMDecodedTxType.TOKEN_APPROVE,
    info: {
      type: EVMDecodedTxType.TOKEN_APPROVE,
      token,
      amount,
      value: paramsMap.value,
      spender: paramsMap.spender,
      isUInt256Max: amount === InfiniteAmountText,
    },
  };
};

const parseCovalentType = (covalentTx: Transaction) => {
  const parsers = [
    paraseTokenTransferLog,
    paraseNativeTransfer,
    paraseSpam,
    paraseTokenInteraction,
  ];

  let parseResult: ParseResult = null;
  for (const parser of parsers) {
    const result = parser(covalentTx);
    if (result) {
      parseResult = result;
      break;
    }
  }

  if (parseResult) {
    return parseResult;
  }

  return { type: covalentTx.txType, info: null };
};

const parseCovalent = (covalentTx: Transaction, network: Network) => {
  const itemBuilder = {} as EVMDecodedItem;
  const { type, info } = parseCovalentType(covalentTx);
  itemBuilder.txType = type;
  itemBuilder.info = info;
  itemBuilder.mainSource = 'covalent';
  itemBuilder.txStatus = covalentTx.successful;
  itemBuilder.symbol = network.symbol;
  itemBuilder.value = covalentTx.value;
  itemBuilder.amount = ethers.utils.formatEther(covalentTx.value);
  itemBuilder.fiatAmount = covalentTx.valueQuote;
  itemBuilder.network = network;

  itemBuilder.fromAddress = covalentTx.fromAddress;
  itemBuilder.toAddress = covalentTx.toAddress;
  itemBuilder.txHash = covalentTx.txHash;
  itemBuilder.chainId = covalentTx.chainId;
  itemBuilder.fromType =
    covalentTx.fromType === EVMTxFromType.IN ? 'IN' : 'OUT';
  itemBuilder.gasInfo = parseGasInfo(null, covalentTx);
  itemBuilder.blockSignedAt = new Date(covalentTx.blockSignedAt).getTime();
  itemBuilder.total = ethers.utils.formatEther(
    ethers.utils
      .parseEther(itemBuilder.value)
      .add(
        ethers.utils.parseEther(
          itemBuilder.gasInfo.feeSpend || itemBuilder.gasInfo.maxFeeSpend,
        ),
      ),
  );

  return itemBuilder;
};

export { parseCovalent, parseGasInfo };
