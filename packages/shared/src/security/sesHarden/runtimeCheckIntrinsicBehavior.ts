import { assertSesBehavior, checkSesBehavior } from './runtimeCheckBehavior';

import type { ISesCheckDeadline } from './runtimeCheckDeadline';

export function runSesIntrinsicBehaviorChecks(options?: ISesCheckDeadline) {
  return Promise.all([
    checkSesBehavior(
      'Array algorithms and mutation',
      '验证数组算法及实例可写性。',
      () => {
        const values = [1, 2, 3];
        assertSesBehavior(
          values
            .map((value) => value * 2)
            .filter((value) => value > 2)
            .reduce((sum, value) => sum + value, 0) === 10,
          'map/filter/reduce',
        );
        assertSesBehavior(
          values.find((value) => value === 2) === 2 &&
            values.findIndex((value) => value === 3) === 2 &&
            values.every((value) => value > 0) &&
            values.some((value) => value === 2) &&
            values.includes(3),
          'array predicates',
        );
        values.push(4);
        assertSesBehavior(values.pop() === 4, 'push/pop');
        values.splice(1, 1, 5);
        assertSesBehavior(
          values
            .slice()
            .toSorted((a, b) => a - b)
            .join(',') === '1,3,5' && values.join(',') === '1,5,3',
          'splice/slice/sort and receiver independence',
        );
        return 'map/filter/reduce, find/findIndex/every/some/includes, push/pop/splice/slice/sort';
      },
      options,
    ),
    checkSesBehavior(
      'TypedArray constructors and copies',
      '验证数值字节视图及实例拷贝。',
      () => {
        for (const Type of [
          Int8Array,
          Uint8Array,
          Uint8ClampedArray,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
        ]) {
          const view = new Type([1, 2, 3]);
          const copied = view.slice();
          view.set([4], 1);
          assertSesBehavior(
            view.subarray(1).join(',') === '4,3' &&
              copied.join(',') === '1,2,3' &&
              ArrayBuffer.isView(view),
            `${Type.name} copy/set/subarray`,
          );
        }
        const buffer = new ArrayBuffer(8);
        assertSesBehavior(
          buffer.slice(2).byteLength === 6,
          'ArrayBuffer slice',
        );
        return 'all nine numeric TypedArray constructors, set/slice/subarray, ArrayBuffer.isView/slice';
      },
      options,
    ),
    checkSesBehavior(
      'Error and Proxy behavior',
      '验证异常构造器、错误传播与 Proxy 撤销。',
      () => {
        for (const Constructor of [
          Error,
          EvalError,
          RangeError,
          ReferenceError,
          SyntaxError,
          TypeError,
          URIError,
        ]) {
          const error = new Constructor('public SES error fixture');
          assertSesBehavior(
            error instanceof Error &&
              error.message === 'public SES error fixture' &&
              error.toString().includes('public SES error fixture'),
            `${Constructor.name} message/prototype`,
          );
        }
        const { proxy, revoke } = Proxy.revocable(
          { value: 21 },
          {
            get: (target, key, receiver) =>
              Number(Reflect.get(target, key, receiver)) * 2,
          },
        );
        assertSesBehavior(proxy.value === 42, 'Proxy trap');
        revoke();
        let rejected = false;
        try {
          void proxy.value;
        } catch (error) {
          rejected = error instanceof TypeError;
        }
        assertSesBehavior(rejected, 'revoked Proxy throws TypeError');
        return 'Error/EvalError/RangeError/ReferenceError/SyntaxError/TypeError/URIError, Proxy trap/revocation';
      },
      options,
    ),
    checkSesBehavior(
      'Object and Reflect behavior',
      '验证对象、属性描述符与反射函数。',
      () => {
        const prototype = { inherited: 7 };
        const target = Object.assign(
          Object.create(prototype) as { value: number },
          { value: 1 },
        );
        const symbol = Symbol('fixture');
        Object.defineProperty(target, symbol, {
          get: () => target.value * 2,
          configurable: true,
        });
        assertSesBehavior(
          Reflect.set(target, 'value', 21) &&
            Reflect.get(target, symbol) === 42,
          'Reflect accessors',
        );
        assertSesBehavior(
          Object.getPrototypeOf(target) === prototype &&
            Reflect.get(target, 'inherited') === 7,
          'prototype lookup',
        );
        assertSesBehavior(
          Reflect.ownKeys(target).includes(symbol) &&
            typeof Object.getOwnPropertyDescriptor(target, symbol)?.get ===
              'function',
          'symbol descriptor',
        );
        assertSesBehavior(
          Reflect.deleteProperty(target, symbol) &&
            !Reflect.has(target, symbol),
          'Reflect deletion',
        );
        assertSesBehavior(
          Object.isFrozen(Object.freeze({ value: 1 })) &&
            Object.isSealed(Object.seal({ value: 1 })),
          'local object integrity',
        );
        return 'create/assign, get/set/has/deleteProperty/ownKeys, symbol accessors, prototype lookup, freeze/seal';
      },
      options,
    ),
    checkSesBehavior(
      'Function and generator behavior',
      '验证函数调用、绑定、继承构造和生成器。',
      async () => {
        function sum(this: { base: number }, a: number, b: number) {
          return this.base + a + b;
        }
        const receiver = { base: 1 };
        assertSesBehavior(
          sum.call(receiver, 2, 3) === 6 &&
            sum.apply(receiver, [2, 3]) === 6 &&
            sum.bind(receiver, 2)(3) === 6 &&
            Reflect.apply(sum, receiver, [2, 3]) === 6,
          'call/apply/bind',
        );
        assertSesBehavior(
          (Reflect.construct(Date, [0]) as Date).getTime() === 0,
          'Reflect.construct',
        );
        function* generate() {
          yield 1;
          return 2;
        }
        const iterator = generate();
        assertSesBehavior(
          iterator.next().value === 1 &&
            iterator.next().value === 2 &&
            iterator.next().done === true,
          'generator iteration',
        );
        async function* generateAsync() {
          yield await Promise.resolve(3);
        }
        const asyncIterator = generateAsync();
        assertSesBehavior(
          (await asyncIterator.next()).value === 3 &&
            (await asyncIterator.next()).done === true,
          'async generator iteration',
        );
        return 'call/apply/bind, Reflect.apply/construct, generator and async-generator next/done';
      },
      options,
    ),
    checkSesBehavior(
      'Date Math and Number behavior',
      '验证日期和数值函数。',
      () => {
        const time = Date.UTC(2020, 0, 2, 3, 4, 5);
        const hex = 'ff';
        assertSesBehavior(
          new Date(time).toISOString() === '2020-01-02T03:04:05.000Z' &&
            Date.parse('2020-01-02T03:04:05.000Z') === time &&
            Number.isFinite(Date.now()),
          'Date UTC/parse/now',
        );
        assertSesBehavior(
          Math.sqrt(81) === 9 &&
            Math.pow(2, 8) === 256 &&
            Math.round(1.6) === 2 &&
            Math.min(3, 1) === 1 &&
            Math.max(3, 1) === 3 &&
            Math.abs(-2) === 2,
          'Math arithmetic',
        );
        assertSesBehavior(
          Number.isInteger(42) &&
            Number.isNaN(Number('fixture')) &&
            Number.parseInt(hex, 16) === 255 &&
            Number.parseFloat('2.5') === 2.5 &&
            (1.25).toFixed(2) === '1.25',
          'Number conversion',
        );
        return 'Date UTC/parse/now/toISOString, Math arithmetic, Number validation/parsing/formatting';
      },
      options,
    ),
    checkSesBehavior(
      'String RegExp and Symbol behavior',
      '验证字符串、正则和 Symbol 函数。',
      () => {
        assertSesBehavior(
          'e\u0301'.normalize('NFC') === 'é' &&
            'OneKey'.includes('Key') &&
            ' A '.trim().toLowerCase() === 'a' &&
            'onekey'.toUpperCase() === 'ONEKEY',
          'String normalization/case',
        );
        const regex = /key/giu;
        assertSesBehavior(
          regex.exec('OneKey KEY')?.index === 3 &&
            regex.exec('OneKey KEY')?.index === 7 &&
            !regex.test('OneKey KEY'),
          'RegExp exec/lastIndex',
        );
        assertSesBehavior(
          'a1b2'.replace(/\d/gu, '#') === 'a#b#' &&
            'a,b'.split(',').join('-') === 'a-b',
          'String replace/split',
        );
        const symbol = Symbol.for('onekey.ses.public.fixture');
        assertSesBehavior(
          Symbol.keyFor(symbol) === 'onekey.ses.public.fixture' &&
            Object.is(symbol, Symbol.for('onekey.ses.public.fixture')) &&
            Array.from('🔐').length === 1,
          'Symbol registry and string iterator',
        );
        return 'normalize/case/trim/includes, replace/split, RegExp exec/test/lastIndex, Symbol.for/keyFor and Unicode iteration';
      },
      options,
    ),
  ]);
}
