import { OneKeyLocalError } from '../../errors';

import { BaseScene } from './baseScene';
import {
  LogToConsole,
  LogToConsoleDevOnly,
  LogToLocal,
  LogToLocalDevOnly,
  LogToServer,
} from './decorators';

import type { IMethodDecoratorMetadata } from '../types';

class NestedCallTestScene extends BaseScene {
  devOnlyMethodCallCount = 0;

  emissions: Array<{
    methodName: string;
    args: unknown[];
    metadataList: IMethodDecoratorMetadata[];
  }> = [];

  override _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: IMethodDecoratorMetadata[],
  ) {
    this.emissions.push({
      methodName,
      args,
      metadataList,
    });
  }

  @LogToLocal()
  methodA() {
    this.methodB();
    return ['fromA'];
  }

  @LogToConsole()
  methodB() {
    return ['fromB'];
  }

  @LogToServer()
  @LogToLocal()
  emptyBodyEvent() {}

  @LogToLocal()
  singleDecoratorEmpty() {}

  @LogToConsoleDevOnly()
  devOnlyMethod() {
    this.devOnlyMethodCallCount += 1;
    return ['devOnly'];
  }

  @LogToLocalDevOnly()
  devOnlyLocalMethod() {
    return ['devOnlyLocal'];
  }

  @LogToConsoleDevOnly()
  throwingDevOnlyMethod() {
    throw new OneKeyLocalError('diagnostic formatter failed');
  }

  @LogToServer()
  @LogToConsoleDevOnly()
  devOnlyConsoleAndServerMethod() {
    return ['serverStillEnabled'];
  }

  @LogToConsoleDevOnly()
  @LogToServer()
  devOnlyOuterAndServerMethod() {
    return ['outerServerStillEnabled'];
  }

  @LogToServer()
  @LogToConsoleDevOnly()
  devOnlyConsoleAndServerEmptyMethod() {}

  @LogToConsoleDevOnly()
  @LogToServer()
  devOnlyOuterAndServerEmptyMethod() {}
}

describe('logger decorators', () => {
  it('keeps nested decorated method calls isolated per method invocation', () => {
    const scene = new NestedCallTestScene();

    scene.methodA();

    expect(scene.emissions).toEqual([
      {
        methodName: 'methodB',
        args: ['fromB'],
        metadataList: [{ level: 'info', type: 'console' }],
      },
      {
        methodName: 'methodA',
        args: ['fromA'],
        metadataList: [{ level: 'info', type: 'local' }],
      },
    ]);
  });

  it('emits payload-less events whose method body has no return statement', () => {
    // Regression guard for #10959: empty-body methods such as `appStart()` were
    // being silently dropped because the decorator treated `result === undefined`
    // as a skip signal even when wrapping the user's actual method.
    const scene = new NestedCallTestScene();

    scene.emptyBodyEvent();
    scene.singleDecoratorEmpty();

    expect(scene.emissions).toEqual([
      {
        methodName: 'emptyBodyEvent',
        args: [undefined],
        metadataList: [
          { level: 'info', type: 'local' },
          { level: 'info', type: 'server' },
        ],
      },
      {
        methodName: 'singleDecoratorEmpty',
        args: [undefined],
        metadataList: [{ level: 'info', type: 'local' }],
      },
    ]);
  });

  it('marks development-only console logs in decorator metadata', () => {
    const scene = new NestedCallTestScene();

    scene.devOnlyMethod();

    expect(scene.emissions).toEqual([
      {
        methodName: 'devOnlyMethod',
        args: ['devOnly'],
        metadataList: [{ devOnly: true, level: 'info', type: 'console' }],
      },
    ]);
  });

  it('does not emit development-only log methods in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const scene = new NestedCallTestScene();

      scene.devOnlyMethod();
      scene.devOnlyLocalMethod();

      expect(scene.devOnlyMethodCallCount).toBe(0);
      expect(scene.emissions).toEqual([]);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('does not let a development-only formatter break production flows', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const scene = new NestedCallTestScene();

      expect(() => scene.throwingDevOnlyMethod()).not.toThrow();
      expect(scene.emissions).toEqual([]);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('keeps non-development decorators active in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const scene = new NestedCallTestScene();

      scene.devOnlyConsoleAndServerMethod();
      scene.devOnlyOuterAndServerMethod();
      scene.devOnlyConsoleAndServerEmptyMethod();
      scene.devOnlyOuterAndServerEmptyMethod();

      expect(scene.emissions).toEqual([
        {
          methodName: 'devOnlyConsoleAndServerMethod',
          args: ['serverStillEnabled'],
          metadataList: [{ level: 'info', type: 'server' }],
        },
        {
          methodName: 'devOnlyOuterAndServerMethod',
          args: ['outerServerStillEnabled'],
          metadataList: [{ level: 'info', type: 'server' }],
        },
        {
          methodName: 'devOnlyConsoleAndServerEmptyMethod',
          args: [undefined],
          metadataList: [{ level: 'info', type: 'server' }],
        },
        {
          methodName: 'devOnlyOuterAndServerEmptyMethod',
          args: [undefined],
          metadataList: [{ level: 'info', type: 'server' }],
        },
      ]);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
