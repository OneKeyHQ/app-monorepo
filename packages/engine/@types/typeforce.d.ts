declare module 'typeforce' {
  interface Typeforce {
    (type: any, value: any, strict?: any, surrogate?: any): boolean;

    Array(value: any): value is any[];
    ArrayN(length: number): (value: any) => value is any[];
    Boolean(value: any): value is boolean;
    Buffer(value: any): value is Buffer;
    BufferN(length: number): (value: any) => value is Buffer;
    Finite(value: any): value is number;
    Function(value: any): value is FunctionConstructor;
    Hex(value: any): value is string;
    HexN(length: number): (value: any) => value is string;
    Nil(value: any): boolean;
    // Null(value: any): boolean; // to be deprecated, use Nil
    Number(value: any): value is number;
    Object(value: any): value is ObjectConstructor;
    Range(a: any, b: any, f: any): boolean;
    String(value: any): value is string;
    StringN(length: number): (value: any) => value is string;
    Int8(value: any): value is number;
    Int16(value: any): value is number;
    Int32(value: any): value is number;
    Int53(value: any): value is number;
    UInt8(value: any): value is number;
    UInt16(value: any): value is number;
    UInt32(value: any): value is number;
    UInt53(value: any): value is number;

    arrayOf(type: any, options?: any): boolean;
    maybe(type: any): boolean;
    map(propertyType: any, propertyKeyType: any): boolean;
    object(uncompiled: any): boolean;
    anyOf(...args: any[]): (value: any) => boolean;
    // oneOf(...args: any[]): boolean; // to be deprecated, use anyOf
    allOf(...args: any[]): boolean;
    quacksLike<T>(type: T): type is T;
    tuple(...args: any[]): boolean;
    value(...expected: any[]): (value: any) => boolean;
    compile(type: any): boolean;
  }

  const tf: Typeforce;
  export = tf;
}
