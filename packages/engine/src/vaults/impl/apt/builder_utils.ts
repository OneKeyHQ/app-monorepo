/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { TxnBuilderTypes } from 'aptos';

function bail(message: string) {
  throw new Error(message);
}

function isWhiteSpace(c: string): boolean {
  if (/\s/.exec(c)) {
    return true;
  }
  return false;
}

function isValidAlphabetic(c: string): boolean {
  if (c.match(/[_A-Za-z0-9]/g)) {
    return true;
  }
  return false;
}

type TokenType = string;
type TokenValue = string;
type Token = [TokenType, TokenValue];

// Returns Token and Token byte size
function nextToken(tagStr: string, pos: number): [Token, number] {
  const c = tagStr[pos];
  if (c === ':') {
    if (tagStr.slice(pos, pos + 2) === '::') {
      return [['COLON', '::'], 2];
    }
    bail('Unrecognized token.');
  } else if (c === '<') {
    return [['LT', '<'], 1];
  } else if (c === '>') {
    return [['GT', '>'], 1];
  } else if (c === ',') {
    return [['COMMA', ','], 1];
  } else if (isWhiteSpace(c)) {
    let res = '';
    for (let i = pos; i < tagStr.length; i += 1) {
      const char = tagStr[i];
      if (isWhiteSpace(char)) {
        res = `${res}${char}`;
      } else {
        break;
      }
    }
    return [['SPACE', res], res.length];
  } else if (isValidAlphabetic(c)) {
    let res = '';
    for (let i = pos; i < tagStr.length; i += 1) {
      const char = tagStr[i];
      if (isValidAlphabetic(char)) {
        res = `${res}${char}`;
      } else {
        break;
      }
    }
    return [['IDENT', res], res.length];
  }
  throw new Error('Unrecognized token.');
}

function tokenize(tagStr: string): Token[] {
  let pos = 0;
  const tokens = [];
  while (pos < tagStr.length) {
    const [token, size] = nextToken(tagStr, pos);
    if (token[0] !== 'SPACE') {
      tokens.push(token);
    }
    pos += size;
  }
  return tokens;
}

/**
 * Parser to parse a type tag string
 */
export class TypeTagParser {
  private readonly tokens: Token[];

  constructor(tagStr: string) {
    this.tokens = tokenize(tagStr);
  }

  private consume(targetToken: string) {
    const token = this.tokens.shift();
    if (!token || token[1] !== targetToken) {
      bail('Invalid type tag.');
    }
  }

  private parseCommaList(
    endToken: TokenValue,
    allowTraillingComma: boolean,
  ): TxnBuilderTypes.TypeTag[] {
    const res: TxnBuilderTypes.TypeTag[] = [];
    if (this.tokens.length <= 0) {
      bail('Invalid type tag.');
    }

    while (this.tokens[0][1] !== endToken) {
      res.push(this.parseTypeTag());

      if (this.tokens.length > 0 && this.tokens[0][1] === endToken) {
        break;
      }

      this.consume(',');
      if (
        this.tokens.length > 0 &&
        this.tokens[0][1] === endToken &&
        allowTraillingComma
      ) {
        break;
      }

      if (this.tokens.length <= 0) {
        bail('Invalid type tag.');
      }
    }
    return res;
  }

  parseTypeTag(): TxnBuilderTypes.TypeTag {
    if (this.tokens.length === 0) {
      bail('Invalid type tag.');
    }

    // Pop left most element out
    // @ts-ignore
    const [tokenTy, tokenVal] = this.tokens.shift();

    if (tokenVal === 'u8') {
      return new TxnBuilderTypes.TypeTagU8();
    }
    if (tokenVal === 'u64') {
      return new TxnBuilderTypes.TypeTagU64();
    }
    if (tokenVal === 'u128') {
      return new TxnBuilderTypes.TypeTagU128();
    }
    if (tokenVal === 'bool') {
      return new TxnBuilderTypes.TypeTagBool();
    }
    if (tokenVal === 'address') {
      return new TxnBuilderTypes.TypeTagAddress();
    }
    if (tokenVal === 'vector') {
      this.consume('<');
      const res = this.parseTypeTag();
      this.consume('>');
      return new TxnBuilderTypes.TypeTagVector(res);
    }
    if (
      tokenTy === 'IDENT' &&
      (tokenVal.startsWith('0x') || tokenVal.startsWith('0X'))
    ) {
      const address = tokenVal;
      this.consume('::');
      const [moduleTokenTy, module] = this.tokens.shift();
      if (moduleTokenTy !== 'IDENT') {
        bail('Invalid type tag.');
      }
      this.consume('::');
      const [nameTokenTy, name] = this.tokens.shift();
      if (nameTokenTy !== 'IDENT') {
        bail('Invalid type tag.');
      }

      let tyTags: TxnBuilderTypes.TypeTag[] = [];
      // Check if the struct has ty args
      if (this.tokens.length > 0 && this.tokens[0][1] === '<') {
        this.consume('<');
        tyTags = this.parseCommaList('>', true);
        this.consume('>');
      }

      const structTag = new TxnBuilderTypes.StructTag(
        TxnBuilderTypes.AccountAddress.fromHex(address),
        new TxnBuilderTypes.Identifier(module),
        new TxnBuilderTypes.Identifier(name),
        tyTags,
      );
      return new TxnBuilderTypes.TypeTagStruct(structTag);
    }

    throw new Error('Invalid type tag.');
  }
}
