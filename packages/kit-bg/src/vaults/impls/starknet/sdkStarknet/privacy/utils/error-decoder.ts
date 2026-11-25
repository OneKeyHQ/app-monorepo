/**
 * Starknet error decoding utilities.
 * Converts hex error messages and function selectors to human-readable strings.
 */

import { hash } from "starknet";

// Common Starknet function names for selector lookup
const COMMON_FUNCTIONS = [
  // Account functions
  "__execute__",
  "__validate__",
  "__validate_declare__",
  "__validate_deploy__",
  "is_valid_signature",
  "get_nonce",
  // ERC20
  "transfer",
  "transfer_from",
  "approve",
  "balance_of",
  "allowance",
  "total_supply",
  "name",
  "symbol",
  "decimals",
  // ERC721
  "owner_of",
  "safe_transfer_from",
  "set_approval_for_all",
  "get_approved",
  "is_approved_for_all",
  // Outside execution (SNIP-9)
  "execute_from_outside",
  "execute_from_outside_v2",
  "is_valid_outside_execution_nonce",
  // Ownable
  "owner",
  "transfer_ownership",
  "renounce_ownership",
  // Upgradeable
  "upgrade",
  // Access control
  "has_role",
  "grant_role",
  "revoke_role",
  // Privacy pool specific
  "register",
  "deposit",
  "withdraw",
  "get_public_key",
  "set_viewing_key",
  "get_note",
  "get_nullifier",
  "get_channel",
];

// Build selector -> name map
const selectorToName = new Map<string, string>();
for (const name of COMMON_FUNCTIONS) {
  const selector = hash.getSelectorFromName(name);
  selectorToName.set(selector.toLowerCase(), name);
}

/**
 * Add additional function names to the selector lookup map.
 * Useful for extending with ABI-specific functions.
 */
export function addSelectors(names: string[]): void {
  for (const name of names) {
    const selector = hash.getSelectorFromName(name);
    if (!selectorToName.has(selector.toLowerCase())) {
      selectorToName.set(selector.toLowerCase(), name);
    }
  }
}

/**
 * Decoded error information
 */
export interface DecodedError {
  /** Original error object/string */
  raw: unknown;
  /** Decoded with human-readable selectors and error messages */
  decoded: unknown;
}

/**
 * Look up a selector hex value to get the function name
 */
export function lookupSelector(selectorHex: string): string | undefined {
  const normalized = selectorHex.toLowerCase();
  if (selectorToName.has(normalized)) {
    return selectorToName.get(normalized);
  }

  // Try matching without 0x prefix padding differences
  try {
    const selectorBigInt = BigInt(selectorHex);
    for (const [key, name] of Array.from(selectorToName.entries())) {
      if (BigInt(key) === selectorBigInt) {
        return name;
      }
    }
  } catch {
    // Invalid hex, return undefined
  }

  return undefined;
}

/**
 * Convert hex to ASCII string if it looks like printable text
 */
export function hexToString(hex: unknown): unknown {
  if (!hex || typeof hex !== "string") return hex;
  if (!hex.startsWith("0x")) return hex;

  const cleanHex = hex.slice(2);
  let str = "";
  for (let i = 0; i < cleanHex.length; i += 2) {
    const charCode = parseInt(cleanHex.substr(i, 2), 16);
    if (charCode >= 32 && charCode <= 126) {
      str += String.fromCharCode(charCode);
    } else {
      return hex; // Not ASCII, return original
    }
  }
  return str || hex;
}

/**
 * Decode an array of hex error values
 */
export function decodeErrorArray(arr: unknown[]): unknown[] {
  return arr.map((item) => {
    if (typeof item === "string") {
      const decoded = hexToString(item);
      return decoded !== item ? `${decoded} (${item})` : item;
    }
    return decodeValue(item);
  });
}

/**
 * Recursively decode error objects, arrays, and hex strings
 */
export function decodeValue(obj: unknown): unknown {
  if (typeof obj === "string") {
    // Try to parse as JSON
    try {
      return decodeValue(JSON.parse(obj));
    } catch {
      // Single hex value
      const decoded = hexToString(obj);
      return decoded !== obj ? `${decoded} (${obj})` : obj;
    }
  }

  if (Array.isArray(obj)) {
    return decodeErrorArray(obj);
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "selector" && typeof value === "string") {
        // Look up selector name
        const funcName = lookupSelector(value);
        result[key] = funcName ? `${funcName} (${value})` : value;
      } else if (key === "error" && typeof value === "string" && value.startsWith("[")) {
        // Parse array string like "[\"0x...\",\"0x...\"]"
        try {
          const arr = JSON.parse(value);
          result[key] = decodeErrorArray(arr);
        } catch {
          result[key] = decodeValue(value);
        }
      } else {
        result[key] = decodeValue(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Decode error from an RPC error or transaction trace
 */
export function decodeError(error: unknown): DecodedError {
  return {
    raw: error,
    decoded: decodeValue(error),
  };
}
