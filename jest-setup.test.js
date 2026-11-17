// Covers the Buffer equality tester registered in jest-setup.js.

class TaggedBuffer extends Buffer {}

describe('Buffer equality tester', () => {
  it('compares plain Buffers by bytes', () => {
    expect(Buffer.from([1, 2, 3])).toEqual(Buffer.from([1, 2, 3]));
    expect(Buffer.from([1, 2, 3])).toStrictEqual(Buffer.from([1, 2, 3]));
    expect(Buffer.from([1, 2, 3])).not.toEqual(Buffer.from([1, 2, 4]));
    expect(Buffer.from([1, 2, 3])).not.toEqual(Buffer.from([1, 2]));
  });

  it('keeps comparing extra enumerable properties', () => {
    const a = Object.assign(Buffer.from([1]), { tag: 'a' });
    const b = Object.assign(Buffer.from([1]), { tag: 'b' });
    expect(a).not.toEqual(b);
    expect(a).toEqual(Object.assign(Buffer.from([1]), { tag: 'a' }));
    expect(a).not.toEqual(Buffer.from([1]));
  });

  it('keeps the prototype check in toStrictEqual', () => {
    const tagged = Object.setPrototypeOf(
      Buffer.from([1, 2, 3]),
      TaggedBuffer.prototype,
    );
    expect(tagged).not.toStrictEqual(Buffer.from([1, 2, 3]));
  });
});
