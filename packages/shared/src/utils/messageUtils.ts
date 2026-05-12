import { addHexPrefix, isHexString, isValidAddress } from '@ethereumjs/util';
import BigNumber from 'bignumber.js';
import { TYPED_MESSAGE_SCHEMA, typedSignatureHash } from 'eth-sig-util';
import { validate } from 'jsonschema';

import type {
  IUnsignedMessage,
  IUnsignedMessageEth,
} from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { IMPL_CFX } from '../engine/engineConsts';
import { OneKeyError } from '../errors';
import { OneKeyLocalError } from '../errors/errors/localError';

/**
 * Fixes a personal sign message by ensuring it has a valid hex prefix.
 * If the message is not a valid hex-prefixed buffer input, it tries prepending '0x'.
 *
 * Migrated from @onekeyhq/core/src/chains/evm/sdkEvm/signMessage.ts
 * to avoid core dependency in kit/shared.
 */
export function autoFixPersonalSignMessage({ message }: { message: string }) {
  let messageFixed = message;
  // isHexString from @ethereumjs/util requires 0x prefix
  if (!isHexString(message)) {
    const tmpMsg = `0x${message}`;
    if (isHexString(tmpMsg)) {
      messageFixed = tmpMsg;
    }
  }
  return messageFixed;
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

const stripOneLayerOfNesting = (potentialArrayType: string) =>
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
    throw new OneKeyLocalError(`Invalid types definition`);
  }

  // Primary type can be an array.
  const isArray = primaryType && isArrayType(primaryType);
  if (isArray) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return msg.map((value: { [key: string]: any }) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      sanitizeMessage(value, stripOneLayerOfNesting(primaryType), types),
    );
  }
  if (isSolidityType(primaryType)) {
    return msg;
  }

  // If not, assume to be struct
  const baseType = isArray ? stripArrayType(primaryType) : primaryType;

  const baseTypeDefinitions = types[baseType];
  if (!baseTypeDefinitions) {
    throw new OneKeyLocalError(`Invalid primary type definition`);
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

export function getValidUnsignedMessage(unsignedMessage: IUnsignedMessage) {
  try {
    const { type, message } = unsignedMessage;

    if (
      type === EMessageTypesEth.TYPED_DATA_V3 ||
      type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      let messageObject: {
        domain: { chainId: string };
        types: {
          EIP712Domain: { name: string; type: string }[];
          [key: string]: { name: string; type: string }[];
        };
        primaryType: string;
        message: { [key: string]: any };
      };

      if (typeof message === 'object') {
        messageObject = message;
      } else {
        messageObject = JSON.parse(message);
      }

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

async function validateAddress({
  address,
  propertyName,
  impl,
}: {
  address: string | undefined;
  propertyName: string;
  impl?: string;
}) {
  let isValid = false;

  if (address && typeof address === 'string') {
    if (impl === IMPL_CFX) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const { isValidCfxAddress } =
        await import('@conflux-dev/conflux-address-js');
      isValid = (isValidCfxAddress as (addr: string) => boolean)(address);
    } else {
      isValid = isValidHexAddress(address);
    }
  }

  if (!isValid) {
    throw new OneKeyLocalError(
      `Invalid "${propertyName}" address: ${String(
        address,
      )} must be a valid string.`,
    );
  }
}

export async function validateSignMessageData(
  unsignedMessage: IUnsignedMessageEth,
  impl?: string,
) {
  const { payload = [] } = unsignedMessage;
  let message;
  let from;

  if (unsignedMessage.type === EMessageTypesEth.PERSONAL_SIGN) {
    [message, from] = payload as [string, string];
  } else if (unsignedMessage.type === EMessageTypesEth.ETH_SIGN) {
    [from, message] = payload as [string, string];
  }
  await validateAddress({
    address: from,
    propertyName: 'from',
    impl,
  });
  if (!message || typeof message !== 'string') {
    throw new OneKeyError(
      `Invalid message: ${String(message)} must be a valid string.`,
    );
  }
}

export async function validateTypedSignMessageDataV1(
  unsignedMessage: IUnsignedMessageEth,
  impl?: string,
) {
  const { payload = [] } = unsignedMessage;
  const [message, from] = payload as [
    Array<{ name: string; type: string; value: string }>,
    string,
  ];
  await validateAddress({
    address: from,
    propertyName: 'from',
    impl,
  });

  if (!message || !Array.isArray(message)) {
    throw new OneKeyError(
      `Invalid message: ${String(message)} must be a valid array.`,
    );
  }

  try {
    // typedSignatureHash will throw if the data is invalid.
    typedSignatureHash(message as any);
  } catch (_e) {
    throw new OneKeyLocalError(`Expected EIP712 typed data.`);
  }
}

export async function validateTypedSignMessageDataV3V4(
  unsignedMessage: IUnsignedMessageEth,
  currentChainId: string | undefined,
  impl?: string,
) {
  const { payload = [] } = unsignedMessage;
  const [from, message] = payload as [string, string];
  let messageObject: {
    domain: { chainId: string };
    types: { EIP712Domain: { name: string; type: string }[] };
  };

  await validateAddress({
    address: from,
    propertyName: 'from',
    impl,
  });

  if (
    !message ||
    Array.isArray(message) ||
    (typeof message !== 'object' && typeof message !== 'string')
  ) {
    throw new OneKeyLocalError(
      `Invalid message: Must be a valid string or object.`,
    );
  }

  if (typeof message === 'object') {
    messageObject = message;
  } else {
    try {
      messageObject = JSON.parse(message);
    } catch (_e) {
      throw new OneKeyLocalError(
        'Message data must be passed as a valid JSON string.',
      );
    }
  }

  const validation = validate(messageObject, TYPED_MESSAGE_SCHEMA);
  if (validation.errors.length > 0) {
    throw new OneKeyError('Message Data must conform to EIP-712 schema.');
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
        `OneKey Sign Message ERROR: Provided chainId "${chainIdBN.toFixed()}" must match the active chainId "${activeChainIdBN.toFixed()}"`,
      );
    }
  }
}
