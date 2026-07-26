export type IStrictJsonFailure = (message: string) => never;

class StrictJsonParser {
  private offset = 0;

  constructor(
    private readonly input: string,
    private readonly fail: IStrictJsonFailure,
  ) {}

  parse(): unknown {
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.offset !== this.input.length) {
      this.fail(`JSON contains trailing data at offset ${this.offset}`);
    }
    return value;
  }

  private skipWhitespace() {
    while (
      this.offset < this.input.length &&
      (this.input[this.offset] === ' ' ||
        this.input[this.offset] === '\n' ||
        this.input[this.offset] === '\r' ||
        this.input[this.offset] === '\t')
    ) {
      this.offset += 1;
    }
  }

  private parseValue(): unknown {
    this.skipWhitespace();
    const token = this.input[this.offset];
    if (token === '{') return this.parseObject();
    if (token === '[') return this.parseArray();
    if (token === '"') return this.parseString();
    if (token === 't') return this.parseKeyword('true', true);
    if (token === 'f') return this.parseKeyword('false', false);
    if (token === 'n') return this.parseKeyword('null', null);
    return this.parseNumber();
  }

  private parseKeyword<T>(keyword: string, value: T): T {
    if (
      this.input.slice(this.offset, this.offset + keyword.length) !== keyword
    ) {
      return this.fail(`invalid JSON token at offset ${this.offset}`);
    }
    this.offset += keyword.length;
    return value;
  }

  private parseString(): string {
    const start = this.offset;
    this.offset += 1;
    while (this.offset < this.input.length) {
      const character = this.input[this.offset];
      if (character === '"') {
        this.offset += 1;
        try {
          return JSON.parse(this.input.slice(start, this.offset)) as string;
        } catch {
          return this.fail(`invalid JSON string at offset ${start}`);
        }
      }
      if (character === '\\') {
        this.offset += 2;
      } else {
        if (character.charCodeAt(0) <= 0x1f) {
          return this.fail(
            `invalid control character at offset ${this.offset}`,
          );
        }
        this.offset += 1;
      }
    }
    return this.fail(`unterminated JSON string at offset ${start}`);
  }

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      this.input.slice(this.offset),
    );
    if (!match) {
      return this.fail(`invalid JSON number at offset ${this.offset}`);
    }
    this.offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      return this.fail(`non-finite JSON number at offset ${this.offset}`);
    }
    return value;
  }

  private parseArray(): unknown[] {
    this.offset += 1;
    const values: unknown[] = [];
    this.skipWhitespace();
    if (this.input[this.offset] === ']') {
      this.offset += 1;
      return values;
    }
    while (this.offset < this.input.length) {
      values.push(this.parseValue());
      this.skipWhitespace();
      const separator = this.input[this.offset];
      this.offset += 1;
      if (separator === ']') return values;
      if (separator !== ',') {
        return this.fail(
          `invalid JSON array separator at offset ${this.offset - 1}`,
        );
      }
    }
    return this.fail('unterminated JSON array');
  }

  private parseObject(): Record<string, unknown> {
    this.offset += 1;
    const value: Record<string, unknown> = {};
    const keys = new Set<string>();
    this.skipWhitespace();
    if (this.input[this.offset] === '}') {
      this.offset += 1;
      return value;
    }
    while (this.offset < this.input.length) {
      this.skipWhitespace();
      if (this.input[this.offset] !== '"') {
        return this.fail(
          `JSON object key must be a string at offset ${this.offset}`,
        );
      }
      const key = this.parseString();
      if (keys.has(key)) {
        return this.fail(`JSON contains duplicate key ${key}`);
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.input[this.offset] !== ':') {
        return this.fail(`JSON object key ${key} has no value`);
      }
      this.offset += 1;
      value[key] = this.parseValue();
      this.skipWhitespace();
      const separator = this.input[this.offset];
      this.offset += 1;
      if (separator === '}') return value;
      if (separator !== ',') {
        return this.fail(
          `invalid JSON object separator at offset ${this.offset - 1}`,
        );
      }
    }
    return this.fail('unterminated JSON object');
  }
}

export const parseStrictJson = (
  input: string,
  fail: IStrictJsonFailure,
): unknown => new StrictJsonParser(input, fail).parse();
