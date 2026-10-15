import { wrapKeysModuleWithStackCleanup } from './keysMemory';

function createInstance(low = 128, high = 1024) {
  return {
    memory: new WebAssembly.Memory({ initial: 1 }),
    __stack_low: new WebAssembly.Global({ value: 'i32', mutable: false }, low),
    __stack_high: new WebAssembly.Global(
      { value: 'i32', mutable: false },
      high,
    ),
  };
}

describe('keys WASM stack cleanup', () => {
  it.each([false, true])(
    'wipes inactive stack after return (throws=%s) without touching static data or heap',
    (throws) => {
      const instance = createInstance();
      const memory = new Uint8Array(instance.memory.buffer);
      memory.fill(91);
      const error = new Error('synthetic failure');
      const api = wrapKeysModuleWithStackCleanup(
        {
          call: () => {
            if (throws) throw error;
            return memory.slice(128, 132);
          },
        },
        instance,
      );

      if (throws) expect(() => api.call()).toThrow(error);
      else expect(api.call()).toEqual(new Uint8Array([91, 91, 91, 91]));
      expect(memory.subarray(128, 1024).every((byte) => byte === 0)).toBe(true);
      expect(memory[127]).toBe(91);
      expect(memory[1024]).toBe(91);
    },
  );

  it('waits for the outermost WASM call to return before wiping reentrant frames', () => {
    const instance = createInstance();
    const memory = new Uint8Array(instance.memory.buffer);
    const reentry: { inner?: () => void } = {};
    const module = {
      outer: () => {
        memory[256] = 73;
        reentry.inner?.();
        expect(memory[256]).toBe(73);
      },
      inner: () => {
        memory[512] = 42;
      },
    };
    const api = wrapKeysModuleWithStackCleanup(module, instance);
    reentry.inner = api.inner;
    api.outer();
    expect(memory[256]).toBe(0);
    expect(memory[512]).toBe(0);
  });

  it('uses the replacement buffer when memory grows during a call', () => {
    const instance = createInstance();
    const api = wrapKeysModuleWithStackCleanup(
      {
        call: () => {
          instance.memory.grow(1);
          new Uint8Array(instance.memory.buffer)[256] = 42;
        },
      },
      instance,
    );
    api.call();
    expect(new Uint8Array(instance.memory.buffer)[256]).toBe(0);
  });

  it('rejects old artifacts without stack bounds', () => {
    expect(() =>
      wrapKeysModuleWithStackCleanup(
        {},
        { memory: new WebAssembly.Memory({ initial: 1 }) },
      ),
    ).toThrow('stack bounds are missing');
  });

  it.each([
    [-1, 1024],
    [128, 128],
    [1024, 128],
    [128, 65_537],
  ])('rejects invalid bounds %s..%s', (low, high) => {
    expect(() =>
      wrapKeysModuleWithStackCleanup({}, createInstance(low, high)),
    ).toThrow('stack bounds are invalid');
  });
});
