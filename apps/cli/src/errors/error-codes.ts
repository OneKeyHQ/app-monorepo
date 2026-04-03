export const EXIT_CODES = {
  SUCCESS: 0,
  BIZ: 1,
  PARAM: 2,
  NET: 3,
  AUTH: 4,
  SEC: 5,
} as const;

const PREFIX_EXIT_MAP: Record<string, number> = {
  PARAM_: EXIT_CODES.PARAM,
  BIZ_: EXIT_CODES.BIZ,
  NET_: EXIT_CODES.NET,
  AUTH_: EXIT_CODES.AUTH,
  SEC_: EXIT_CODES.SEC,
};

export function getExitCode(code: string): number {
  for (const [prefix, exitCode] of Object.entries(PREFIX_EXIT_MAP)) {
    if (code.startsWith(prefix)) return exitCode;
  }
  return EXIT_CODES.BIZ;
}

export const ERROR_CODES = {
  PARAM_INVALID_TOKEN: {
    code: 'PARAM_INVALID_TOKEN',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_INVALID_CHAIN: {
    code: 'PARAM_INVALID_CHAIN',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_INVALID_ADDRESS: {
    code: 'PARAM_INVALID_ADDRESS',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_INVALID_AMOUNT: {
    code: 'PARAM_INVALID_AMOUNT',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_INVALID_MNEMONIC: {
    code: 'PARAM_INVALID_MNEMONIC',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_MISSING_REQUIRED: {
    code: 'PARAM_MISSING_REQUIRED',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_INVALID_SLIPPAGE: {
    code: 'PARAM_INVALID_SLIPPAGE',
    exitCode: EXIT_CODES.PARAM,
  },
  PARAM_INVALID_CONFIG: {
    code: 'PARAM_INVALID_CONFIG',
    exitCode: EXIT_CODES.PARAM,
  },
  USER_CANCELLED: { code: 'USER_CANCELLED', exitCode: EXIT_CODES.BIZ },
  BIZ_UNKNOWN: { code: 'BIZ_UNKNOWN', exitCode: EXIT_CODES.BIZ },
  BIZ_INSUFFICIENT_BALANCE: {
    code: 'BIZ_INSUFFICIENT_BALANCE',
    exitCode: EXIT_CODES.BIZ,
  },
  BIZ_GAS_ESTIMATION_FAILED: {
    code: 'BIZ_GAS_ESTIMATION_FAILED',
    exitCode: EXIT_CODES.BIZ,
  },
  BIZ_TRANSACTION_FAILED: {
    code: 'BIZ_TRANSACTION_FAILED',
    exitCode: EXIT_CODES.BIZ,
  },
  BIZ_SWAP_QUOTE_EXPIRED: {
    code: 'BIZ_SWAP_QUOTE_EXPIRED',
    exitCode: EXIT_CODES.BIZ,
  },
  NET_RPC_TIMEOUT: { code: 'NET_RPC_TIMEOUT', exitCode: EXIT_CODES.NET },
  NET_RPC_UNREACHABLE: {
    code: 'NET_RPC_UNREACHABLE',
    exitCode: EXIT_CODES.NET,
  },
  NET_HTTP_ERROR: { code: 'NET_HTTP_ERROR', exitCode: EXIT_CODES.NET },
  NET_REQUEST_FAILED: {
    code: 'NET_REQUEST_FAILED',
    exitCode: EXIT_CODES.NET,
  },
  AUTH_NO_WALLET: { code: 'AUTH_NO_WALLET', exitCode: EXIT_CODES.AUTH },
  AUTH_WALLET_EXISTS: {
    code: 'AUTH_WALLET_EXISTS',
    exitCode: EXIT_CODES.AUTH,
  },
  SEC_KEYCHAIN_LOCKED: {
    code: 'SEC_KEYCHAIN_LOCKED',
    exitCode: EXIT_CODES.SEC,
  },
  SEC_KEYCHAIN_ACCESS_DENIED: {
    code: 'SEC_KEYCHAIN_ACCESS_DENIED',
    exitCode: EXIT_CODES.SEC,
  },
  SEC_KEYCHAIN_ERROR: {
    code: 'SEC_KEYCHAIN_ERROR',
    exitCode: EXIT_CODES.SEC,
  },
  SEC_DECRYPTION_FAILED: {
    code: 'SEC_DECRYPTION_FAILED',
    exitCode: EXIT_CODES.SEC,
  },
  SEC_HIGH_RISK_TOKEN: {
    code: 'SEC_HIGH_RISK_TOKEN',
    exitCode: EXIT_CODES.SEC,
  },
  BIZ_SWAP_SLIPPAGE: {
    code: 'BIZ_SWAP_SLIPPAGE',
    exitCode: EXIT_CODES.BIZ,
  },
  BIZ_SWAP_EXPIRED: {
    code: 'BIZ_SWAP_EXPIRED',
    exitCode: EXIT_CODES.BIZ,
  },
  BIZ_SWAP_FAILED: {
    code: 'BIZ_SWAP_FAILED',
    exitCode: EXIT_CODES.BIZ,
  },
  BIZ_TOKEN_NOT_FOUND: {
    code: 'BIZ_TOKEN_NOT_FOUND',
    exitCode: EXIT_CODES.BIZ,
  },
} as const;
