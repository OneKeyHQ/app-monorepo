import { ethers } from '@onekeyfe/blockchain-libs';

import {
  EVMTxFromType,
  LogEvent,
  Transaction,
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

const parseToken = (logEvent: LogEvent, chainId: number): Token => {
  const {
    senderName,
    senderAddress,
    senderContractTickerSymbol,
    senderContractDecimals,
    senderLogoUrl,
  } = logEvent;
  const networkId = `evm--${chainId}`;
  return {
    id: `${networkId}--${senderAddress}`,
    name: senderName,
    networkId,
    tokenIdOnNetwork: senderAddress,
    symbol: senderContractTickerSymbol,
    decimals: senderContractDecimals,
    logoURI: senderLogoUrl,
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

const paraseNativeTransfer: TypeParser = (covalentTx) => {
  if (covalentTx.gasSpent === 21000) {
    return { type: EVMDecodedTxType.NATIVE_TRANSFER, info: null };
  }
  return null;
};

const paraseTokenInteraction: TypeParser = (covalentTx) => {
  const { logEvents } = covalentTx;
  if (!logEvents || !logEvents.length || !logEvents[0].decoded) {
    return null;
  }

  const firstEvent = logEvents[0];
  const { name, params } = firstEvent.decoded;
  if (
    (name !== 'Transfer' && name !== 'Approval') ||
    !params ||
    params.length !== 3
  ) {
    return null;
  }

  const paramsMap = parseDecodedParams(firstEvent);
  const token = parseToken(firstEvent, covalentTx.chainId);
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
  const parsers = [paraseNativeTransfer, paraseSpam, paraseTokenInteraction];

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
