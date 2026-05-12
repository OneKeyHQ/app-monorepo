import {
  TRANSFER_DEEPLINK_URL,
  TRANSFER_PAIRING_CODE_LENGTH,
  TRANSFER_ROOM_ID_LENGTH,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

const ROOM_ID_GROUP_SIZE = 5;
const ROOM_ID_RAW_LENGTH = 10;
const CONNECTION_CODE_GROUP_SIZE = 5;
const CONNECTION_CODE_SEGMENT_COUNT = 8;

export function generateTransferRoomId(): string {
  return stringUtils.addSeparatorToString({
    str: stringUtils.randomString(ROOM_ID_RAW_LENGTH, {
      chars: stringUtils.randomStringCharsSet.base58UpperCase,
    }),
    groupSize: ROOM_ID_GROUP_SIZE,
  });
}

export function generateTransferConnectionCode(): {
  code: string;
  codeWithSeparator: string;
} {
  const code = stringUtils.randomString(
    CONNECTION_CODE_GROUP_SIZE * CONNECTION_CODE_SEGMENT_COUNT,
    {
      chars: stringUtils.randomStringCharsSet.base58UpperCase,
    },
  );

  return {
    code,
    codeWithSeparator: stringUtils.addSeparatorToString({
      str: code,
      groupSize: CONNECTION_CODE_GROUP_SIZE,
    }),
  };
}

export function buildTransferPairingCode({
  roomId,
  codeWithSeparator,
}: {
  roomId: string;
  codeWithSeparator: string;
}): string {
  const pairingCode = `${roomId}-${codeWithSeparator}`.toUpperCase();
  if (pairingCode.length !== TRANSFER_PAIRING_CODE_LENGTH) {
    throw new OneKeyLocalError('Invalid transfer pairing code length');
  }
  return pairingCode;
}

export function parseTransferRoomIdFromPairingCode(
  pairingCode: string,
): string {
  if (pairingCode.length !== TRANSFER_PAIRING_CODE_LENGTH) {
    throw new OneKeyLocalError('Invalid transfer pairing code length');
  }

  const roomId = pairingCode.toUpperCase().split('-').slice(0, 2).join('-');

  if (roomId.length !== TRANSFER_ROOM_ID_LENGTH) {
    throw new OneKeyLocalError('Invalid transfer room id');
  }

  return roomId;
}

export function buildTransferPairingUri(pairingCode: string): string {
  const searchParams = new URLSearchParams({
    code: pairingCode,
  });
  return `${TRANSFER_DEEPLINK_URL}${searchParams.toString()}`;
}

export function buildTransferPairingUriWithServer(
  pairingCode: string,
  customServerUrl?: string,
): string {
  const searchParams = new URLSearchParams({
    code: pairingCode,
  });
  if (customServerUrl) {
    searchParams.set('server', customServerUrl);
  }
  return `${TRANSFER_DEEPLINK_URL}${searchParams.toString()}`;
}
