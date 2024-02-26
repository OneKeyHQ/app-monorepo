import { type IUnsignedMessage } from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

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
    throw new Error(`Invalid types definition`);
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
