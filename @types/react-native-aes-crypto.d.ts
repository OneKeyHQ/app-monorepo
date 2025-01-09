// https://www.npmjs.com/package/@metamask/react-native-aes-crypto
declare module '@metamask/react-native-aes-crypto' {
  export function decrypt(
    base64Data: string,
    base64Key: string,
    base64IV: string,
  ): Promise<string>;

  export function encrypt(
    data: string,
    base64Key: string,
    base64IV: string,
  ): Promise<string>;
}
