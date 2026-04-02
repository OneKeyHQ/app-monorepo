declare module 'biginteger' {
  export class BigInteger {
    constructor(n: number | string | BigInteger, base?: number): BigInteger;

    compare(n: number | string | BigInteger): number;

    divide(n: number | string | BigInteger): BigInteger;

    pow(n: number | string | BigInteger): BigInteger;

    toJSValue(): number;

    lowVal(): number;
  }
}
