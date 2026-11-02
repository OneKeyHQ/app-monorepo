import type { ICaptchaMessage } from '@onekeyhq/shared/src/utils/captchaMessage';

// App-owned metadata only. parseCaptchaMessage deliberately strips this field
// from untrusted provider input.
export type ICaptchaFrameResult = ICaptchaMessage & {
  source?: 'provider_message' | 'host_load_error' | 'host_watchdog';
};

export {
  isCaptchaOrigin,
  parseCaptchaMessage,
} from '@onekeyhq/shared/src/utils/captchaMessage';
export type { ICaptchaMessage } from '@onekeyhq/shared/src/utils/captchaMessage';

export type ICaptchaFrameProps = {
  url: string;
  requestId: string;
  onResult: (message: ICaptchaFrameResult) => void;
};
