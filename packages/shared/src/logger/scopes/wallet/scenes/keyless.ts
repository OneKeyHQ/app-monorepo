import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class KeylessScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public juiceboxRecoverError({
    message,
    sdkError,
  }: {
    message?: string;
    sdkError?: unknown;
  }) {
    return {
      message,
      sdkError,
    };
  }
}
