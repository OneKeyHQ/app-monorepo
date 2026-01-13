// Stellar asset types
export type IStellarAsset =
  | {
      type: 'native';
    }
  | {
      type: 'credit_alphanum4' | 'credit_alphanum12';
      code: string;
      issuer: string;
    }
  | {
      type: 'contract';
      contractId: string;
      // Optional: link to classic asset if this is a SAC (Stellar Asset Contract)
      classicAsset?: {
        code: string;
        issuer: string;
      };
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

  // Indicates if transaction is from dApp (should not be modified)
  isFromDapp?: boolean;
};
