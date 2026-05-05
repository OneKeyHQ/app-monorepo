import type { BaseScene } from './baseScene';
import type { EScopeName, IScope } from '../types';

export abstract class BaseScope implements IScope {
  protected abstract scopeName: EScopeName;

  getName(): EScopeName {
    return this.scopeName;
  }

  createScene<T extends BaseScene>(
    sceneName: string,
    SceneClass: new () => T,
  ): T {
    const instance = new SceneClass();
    instance.scopeName = this.scopeName;
    instance.sceneName = sceneName;
    return instance;
  }
}
