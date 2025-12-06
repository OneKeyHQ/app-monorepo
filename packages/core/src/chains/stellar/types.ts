// Stellar asset types
export type IStellarAsset =
  | {
      type: 'NATIVE';
    }
  | {
      type: 'ALPHANUM4' | 'ALPHANUM12';
      code: string;
      issuer: string;
    };

// Stellar operation types
export type IStellarOperation =
  | {
      type: 'payment';
      source?: string;
      destination: string;
      amount: string;
      asset: IStellarAsset;
    }
  | {
      type: 'createAccount';
      source?: string;
      destination: string;
      startingBalance: string;
    }
  | {
      type: 'changeTrust';
      source?: string;
      asset: IStellarAsset;
      limit?: string;
    };

// Stellar memo types
export type IStellarMemo =
  | {
      type: 0; // MEMO_NONE
    }
  | {
      type: 1; // MEMO_TEXT
      text: string;
    }
  | {
      type: 2; // MEMO_ID
      id: string;
    }
  | {
      type: 3; // MEMO_HASH
      hash: string;
    }
  | {
      type: 4; // MEMO_RETURN
      hash: string;
    };

// Stellar transaction structure (for hardware wallet and easy manipulation)
export type IStellarTransaction = {
  source: string;
  fee: number;
  sequence: number | string;
  // timebounds is REQUIRED for hardware wallet signing
  timebounds: {
    minTime: number;
    maxTime: number;
  };
  memo: IStellarMemo;
  operations: IStellarOperation[];
};

/**
 * Encoded transaction for Stellar
 * Follows dApp standard interface (SEP-0043)
 * Only stores XDR as single source of truth
 */
export type IEncodedTxStellar = {
  // XDR representation (single source of truth)
  xdr: string;

  // Network passphrase (required for signing)
  networkPassphrase: string;

  // BIP44 derivation path (optional, for hardware wallet)
  path?: string;
};

export type IUnsignedMessageStellar = {
  message: string;
};
