import { map, pick } from 'lodash';

import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

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

      // only show the messages that are declared in the types
      const primaryTypes = map(
        messageObject.types[messageObject.primaryType],
        'name',
      );
      const validMessage = pick(messageObject.message, primaryTypes);
      messageObject.message = validMessage;
      unsignedMessage.message = JSON.stringify(messageObject);
    }

    return unsignedMessage;
  } catch {
    return unsignedMessage;
  }
}
