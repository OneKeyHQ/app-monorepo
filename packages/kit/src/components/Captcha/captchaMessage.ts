import type { ICaptchaMessage } from '@onekeyhq/shared/src/utils/captchaMessage';

export {
  isCaptchaOrigin,
  parseCaptchaMessage,
} from '@onekeyhq/shared/src/utils/captchaMessage';
export type { ICaptchaMessage } from '@onekeyhq/shared/src/utils/captchaMessage';

export type ICaptchaFrameProps = {
  url: string;
  requestId: string;
  onResult: (message: ICaptchaMessage) => void;
};
