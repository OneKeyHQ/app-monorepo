/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import BigNumber from 'bignumber.js';
import { TYPED_MESSAGE_SCHEMA, typedSignatureHash } from 'eth-sig-util';
import { addHexPrefix, isHexString, isValidAddress } from 'ethereumjs-util';
import { validate } from 'jsonschema';
import { toString } from 'lodash';

import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

function isValidHexAddress(
  possibleAddress: string,
  { allowNonPrefixed = true } = {},
) {
  const addressToCheck = allowNonPrefixed
    ? addHexPrefix(possibleAddress)
    : possibleAddress;
  if (!isHexString(addressToCheck)) {
    return false;
  }

  return isValidAddress(addressToCheck);
}

function validateAddress(address: string, propertyName: string) {
  if (!address || typeof address !== 'string' || !isValidHexAddress(address)) {
    throw new Error(
      `Invalid "${propertyName}" address: ${address} must be a valid string.`,
    );
  }
}

export function validateSignMessageData(unsignedMessage: IUnsignedMessageEvm) {
  const { payload } = unsignedMessage;
  let message = '';
  let from = '';

  if (unsignedMessage.type === ETHMessageTypes.PERSONAL_SIGN) {
    [message, from] = payload as [string, string];
  } else if (unsignedMessage.type === ETHMessageTypes.ETH_SIGN) {
    [from, message] = payload as [string, string];
  }
  validateAddress(from, 'from');
  if (!message || typeof message !== 'string') {
    throw new OneKeyError(
      `Invalid message "data": ${toString(message)} must be a valid string.`,
    );
  }
}

export function validateTypedSignMessageDataV1(
  unsignedMessage: IUnsignedMessageEvm,
) {
  const { payload } = unsignedMessage;
  const [message, from] = payload as [
    Array<{ name: string; type: string; value: string }>,
    string,
  ];
  validateAddress(from, 'from');

  if (!message || !Array.isArray(message)) {
    throw new OneKeyError(
      `Invalid message "data": ${toString(message)} must be a valid array.`,
    );
  }

  try {
    // typedSignatureHash will throw if the data is invalid.
    typedSignatureHash(message as any);
  } catch (e) {
    throw new Error(`Expected EIP712 typed data.`);
  }
}

export function validateTypedSignMessageDataV3V4(
  unsignedMessage: IUnsignedMessageEvm,
  currentChainId: string | undefined,
) {
  const { payload, message } = unsignedMessage;
  const [from] = payload as [string];
  let messageObject: {
    domain: { chainId: string };
    types: { EIP712Domain: { name: string; type: string }[] };
  };

  validateAddress(from, 'from');

  if (!message || typeof message !== 'string') {
    throw new OneKeyError(
      `Invalid message "data": ${toString(message)} must be a valid string.`,
    );
  }
  try {
    messageObject = JSON.parse(message);
  } catch (e) {
    throw new OneKeyError('Data must be passed as a valid JSON string.');
  }
  const validation = validate(messageObject, TYPED_MESSAGE_SCHEMA);
  if (validation.errors.length > 0) {
    throw new OneKeyError(
      'Data must conform to EIP-712 schema. See https://git.io/fNtcx.',
    );
  }

  if (!currentChainId) {
    throw new OneKeyError('Current chainId cannot be null or undefined.');
  }

  const { chainId } = messageObject.domain;
  if (chainId) {
    const activeChainIdBN = new BigNumber(currentChainId);
    const chainIdBN = new BigNumber(chainId);

    if (activeChainIdBN.isNaN()) {
      throw new OneKeyError(
        `Cannot sign messages for chainId "${chainIdBN.toFixed()}", because OneKey is switching networks.`,
      );
    }

    if (!activeChainIdBN.isEqualTo(chainIdBN)) {
      throw new OneKeyError(
        `Provided chainId "${chainIdBN.toFixed()}" must match the active chainId "${activeChainIdBN.toFixed()}"`,
      );
    }
  }
}

const solidityTypes = () => {
  const types = [
    'bool',
    'address',
    'string',
    'bytes',
    'int',
    'uint',
    'fixed',
    'ufixed',
  ];

  const ints = Array.from(new Array(32)).map(
    (_, index) => `int${(index + 1) * 8}`,
  );
  const uints = Array.from(new Array(32)).map(
    (_, index) => `uint${(index + 1) * 8}`,
  );
  const bytes = Array.from(new Array(32)).map(
    (_, index) => `bytes${index + 1}`,
  );

  const fixedM = Array.from(new Array(32)).map(
    (_, index) => `fixed${(index + 1) * 8}`,
  );
  const ufixedM = Array.from(new Array(32)).map(
    (_, index) => `ufixed${(index + 1) * 8}`,
  );
  const fixed = Array.from(new Array(80)).map((_, index) =>
    fixedM.map((aFixedM) => `${aFixedM}x${index + 1}`),
  );
  const ufixed = Array.from(new Array(80)).map((_, index) =>
    ufixedM.map((auFixedM) => `${auFixedM}x${index + 1}`),
  );

  return [
    ...types,
    ...ints,
    ...uints,
    ...bytes,
    ...fixed.flat(),
    ...ufixed.flat(),
  ];
};

const SOLIDITY_TYPES = solidityTypes();

const stripArrayType = (potentialArrayType: string) =>
  potentialArrayType.replace(/\[[[0-9]*\]*/gu, '');

const stripOneLayerofNesting = (potentialArrayType: string) =>
  potentialArrayType.replace(/\[[[0-9]*\]/u, '');

const isArrayType = (potentialArrayType: string) =>
  potentialArrayType.match(/\[[[0-9]*\]*/u) !== null;

const isSolidityType = (type: string) => SOLIDITY_TYPES.includes(type);

export function sanitizeMessage(
  msg: { [key: string]: any },
  primaryType: string,
  types: { [key: string]: { name: string; type: string }[] },
) {
  if (!types) {
    throw new Error(`Invalid types definition`);
  }

  // Primary type can be an array.
  const isArray = primaryType && isArrayType(primaryType);
  if (isArray) {
    return msg.map((value: { [key: string]: any }) =>
      sanitizeMessage(value, stripOneLayerofNesting(primaryType), types),
    );
  }
  if (isSolidityType(primaryType)) {
    return msg;
  }

  // If not, assume to be struct
  const baseType = isArray ? stripArrayType(primaryType) : primaryType;

  const baseTypeDefinitions = types[baseType];
  if (!baseTypeDefinitions) {
    throw new Error(`Invalid primary type definition`);
  }

  const sanitizedStruct: { [index: string]: any } = {};
  const msgKeys = Object.keys(msg);
  msgKeys.forEach((msgKey) => {
    const definedType = Object.values(baseTypeDefinitions).find(
      (baseTypeDefinition) => baseTypeDefinition.name === msgKey,
    );

    if (!definedType) {
      return;
    }

    sanitizedStruct[msgKey] = sanitizeMessage(
      msg[msgKey],
      definedType.type,
      types,
    );
  });
  return sanitizedStruct;
}

export function getValidUnsignedMessage(unsignedMessage: IUnsignedMessageEvm) {
  try {
    const { type, message } = unsignedMessage;

    if (
      type === ETHMessageTypes.TYPED_DATA_V3 ||
      type === ETHMessageTypes.TYPED_DATA_V4
    ) {
      const messageObject: {
        domain: { chainId: string };
        types: {
          EIP712Domain: { name: string; type: string }[];
          [key: string]: { name: string; type: string }[];
        };
        primaryType: string;
        message: { [key: string]: any };
      } = JSON.parse(message) ?? {};

      const sanitizedMessage = sanitizeMessage(
        messageObject.message,
        messageObject.primaryType,
        messageObject.types,
      );
      messageObject.message = sanitizedMessage;
      unsignedMessage.message = JSON.stringify(messageObject);
    }

    return unsignedMessage;
  } catch {
    return unsignedMessage;
  }
}
