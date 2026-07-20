import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class RequestScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public availabilityResult(params: {
    durationMs: number;
    errorCode: string;
    fallbackStatus: 'failed' | 'not_attempted' | 'success';
    sampleRate: number;
    service: string;
    sniErrorCode: string;
    sniStatus: 'failed' | 'fail_closed' | 'null' | 'success';
    status: 'failed' | 'success';
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public info({ info }: { info: string }) {
    return info;
  }

  @LogToLocal({ level: 'warn' })
  public warn({ info }: { info: string }) {
    return info;
  }

  @LogToLocal({ level: 'error' })
  public error({ info }: { info: string }) {
    return info;
  }
}
