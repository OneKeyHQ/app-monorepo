import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  RequestLimitExceededError,
  TransferInvalidCodeError,
} from '@onekeyhq/shared/src/errors/errors/appErrors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

enum ETransferServerErrorCode {
  // General errors (1000-1099)
  UNKNOWN_ERROR = 1000,
  INVALID_PARAMETER = 1001,
  OPERATION_FAILED = 1002,

  // Rate limiting errors (1100-1199)
  RATE_LIMIT_EXCEEDED = 1100,

  // Timeout errors (1200-1299)
  OPERATION_TIMEOUT = 1200,

  // String/Data validation errors (1300-1399)
  INVALID_GROUP_SIZE = 1300,
  INVALID_LENGTH = 1301,
  EMPTY_CHARACTER_SET = 1302,
  INVALID_ENCODING = 1303,

  // Remote API errors (1400-1499)
  MODULE_REQUIRED = 1400,
  METHOD_NOT_IMPLEMENTED = 1401,
  API_CALL_FAILED = 1402,
  DUPLICATE_SERVICE_NAME = 1403,

  // Crypto errors (1500-1599)
  ZERO_LENGTH_IV = 1500,
  ZERO_LENGTH_KEY = 1501,
  ZERO_LENGTH_DATA = 1502,
  INVALID_AUTH_TAG = 1503,
  HASH_FAILED = 1504,
  ENCRYPTION_FAILED = 1505,
  DECRYPTION_FAILED = 1506,
  KEY_DERIVATION_FAILED = 1507,

  // Server API errors (1600-1699)
  UNKNOWN_API_MODULE = 1600,

  // Room management errors (1700-1799)
  CONTEXT_REQUIRED = 1700,
  INVALID_ROOM_ID = 1701,
  ROOM_NOT_FOUND = 1702,
  CONNECTION_REJECTED = 1703,
  USER_NOT_FOUND = 1704,
  SOCKET_NOT_IN_ROOM = 1705,
  USERS_NOT_IN_ROOM = 1706,
}

function convertToLocalError(
  serverError: unknown | IOneKeyError,
): IOneKeyError {
  const e = serverError as IOneKeyError | undefined;
  if (!e) {
    return new OneKeyLocalError('Unknown transfer server error');
  }
  switch (e.code) {
    case ETransferServerErrorCode.INVALID_ROOM_ID:
    case ETransferServerErrorCode.ROOM_NOT_FOUND:
    case ETransferServerErrorCode.CONNECTION_REJECTED:
      return new TransferInvalidCodeError({ ...e, message: undefined });

    case ETransferServerErrorCode.RATE_LIMIT_EXCEEDED:
      return new RequestLimitExceededError({ ...e, message: undefined });

    default:
      return e;
  }
}

export default {
  convertToLocalError,
};
