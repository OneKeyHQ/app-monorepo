declare module 'ethereumjs-util' {
  export function isValidAddress(address: string): boolean;
  export function isHexPrefixed(str: string): boolean;
  export function addHexPrefix(str: string): string;
  export function stripHexPrefix(str: string): string;
  export function toBuffer(v: unknown): Buffer;
  export function bufferToHex(buf: Buffer): string;
  export function hashPersonalMessage(message: Buffer): Buffer;
  export function isHexString(value: string, length?: number): boolean;
  export function isValidChecksumAddress(
    address: string,
    chainId?: number | null,
  ): boolean;
  export function toChecksumAddress(
    address: string,
    chainId?: number | null,
  ): string;
  export function ecrecover(
    msgHash: Buffer,
    v: bigint | number,
    r: Buffer,
    s: Buffer,
    chainId?: bigint | number,
  ): Buffer;
  export function pubToAddress(pubKey: Buffer, sanitize?: boolean): Buffer;
}
