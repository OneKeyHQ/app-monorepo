import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// for open dev mode
let clickCount = 0;
let startTime: Date | undefined;

let isPasswordVerifying = false;
export const handleOpenDevMode = async (callback: () => void) => {
  const nowTime = new Date();
  if (clickCount === 0) {
    callback();
  }
  if (isPasswordVerifying) {
    return;
  }
  if (
    startTime === undefined ||
    Math.round(nowTime.getTime() - startTime.getTime()) > 5000
  ) {
    startTime = nowTime;
    clickCount = 0;
  } else {
    clickCount += 1;
  }
  if (clickCount >= 9) {
    isPasswordVerifying = true;
    try {
      await backgroundApiProxy.servicePassword.promptPasswordVerify({
        dialogProps: {
          description:
            'Danger Zone: Are you sure you want to enable developer-related features?',
          dismissOnOverlayPress: false,
        },
      });
      await backgroundApiProxy.serviceDevSetting.switchDevMode(true);
    } catch (error) {
      /* empty */
    } finally {
      isPasswordVerifying = false;
    }
  }
};
