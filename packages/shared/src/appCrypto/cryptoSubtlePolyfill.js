const platformEnv = require('@onekeyhq/shared/src/platformEnv');

/**
 * Polyfill crypto.subtle for React Native
 *
 * Purpose:
 * - Enables Supabase Auth PKCE to use s256 (SHA-256) instead of plain method
 * - Supabase's @supabase/auth-js GoTrueClient checks crypto.subtle.digest
 *   to determine PKCE code_challenge method support
 *
 * Implementation Notes:
 * - Uses react-native-aes-crypto native module for SHA hashing
 * - The native module (both iOS/Android) expects HEX-ENCODED string input:
 *   - iOS: AesCrypt.m uses [self fromHex:input] to decode hex to bytes
 *   - Android: Aes.java uses Hex.decode(data) to decode hex to bytes
 * - This is why we convert ArrayBuffer -> hex string before calling native functions
 *
 * Prerequisites:
 * - Must be loaded AFTER the crypto polyfill in polyfillsPlatform.js
 * - Requires react-native-aes-crypto native module to be linked
 *
 * Limitations:
 * - Only implements digest() method (minimum required for Supabase PKCE)
 * - Supports SHA-1, SHA-256, SHA-512 algorithms only
 */
if (platformEnv.isNative) {
  if (typeof crypto !== 'undefined' && typeof crypto.subtle === 'undefined') {
    // Lazy load RN_AES to avoid circular dependency issues at module initialization
    let RN_AES = null;
    const getRNAES = () => {
      if (!RN_AES) {
        RN_AES = require('react-native-aes-crypto').default;
      }
      return RN_AES;
    };

    /**
     * Convert hex string to ArrayBuffer
     * Used to convert native hash result (hex) back to Web Crypto API format (ArrayBuffer)
     */
    const hexToArrayBuffer = (hex) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes.buffer;
    };

    /**
     * Convert ArrayBuffer/Uint8Array to hex string
     * Required because react-native-aes-crypto native module expects hex-encoded input
     * @see iOS: AesCrypt.m - [self fromHex:input]
     * @see Android: Aes.java - Hex.decode(data)
     */
    const arrayBufferToHex = (buffer) => {
      const bytes = new Uint8Array(buffer);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    };

    // Create a minimal crypto.subtle polyfill (only digest() for Supabase PKCE)
    crypto.subtle = {
      /**
       * Compute hash digest using react-native-aes-crypto native module
       * Implements Web Crypto API's SubtleCrypto.digest() interface
       * @param {string} algorithm - Hash algorithm (e.g., 'SHA-256', 'SHA-512', 'SHA-1')
       * @param {ArrayBuffer|Uint8Array} data - Data to hash
       * @returns {Promise<ArrayBuffer>} - Hash result as ArrayBuffer
       */
      digest: async (algorithm, data) => {
        // Normalize algorithm name: 'SHA-256' -> 'SHA256'
        const normalizedAlgorithm = algorithm.toUpperCase().replace('-', '');
        // Convert input to hex (required by react-native-aes-crypto native module)
        const hexData = arrayBufferToHex(data);
        const rnAes = getRNAES();

        let hashHex;
        switch (normalizedAlgorithm) {
          case 'SHA256':
            hashHex = await rnAes.sha256(hexData);
            break;
          case 'SHA512':
            hashHex = await rnAes.sha512(hexData);
            break;
          case 'SHA1':
            hashHex = await rnAes.sha1(hexData);
            break;
          default:
            throw new Error(
              `crypto.subtle.digest: Unsupported algorithm "${algorithm}"`,
            );
        }

        // Convert hex result back to ArrayBuffer (Web Crypto API format)
        return hexToArrayBuffer(hashHex);
      },
    };
  }
}
