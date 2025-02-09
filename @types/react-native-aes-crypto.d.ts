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

  // 添加 PBKDF2 密钥派生函数
  export function pbkdf2(password: string, salt: string): Promise<string>;

  // 添加 HMAC-SHA256 函数
  export function hmac256(data: string, key: string): Promise<string>;

  // 添加各种哈希函数
  export function sha256(data: string): Promise<string>;
  export function sha1(data: string): Promise<string>;
  export function sha512(data: string): Promise<string>;

  // 添加随机 UUID 生成函数
  export function randomUuid(): Promise<string>;

  // 添加随机密钥生成函数
  export function randomKey(length: number): Promise<string>;
}
