import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// for open dev mode
let clickCount = 0;
let startTime: Date | undefined;

export const handleOpenDevMode = (callback: () => void) => {
  const nowTime = new Date();
  if (clickCount === 0) {
    callback();
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
    void backgroundApiProxy.serviceDevSetting.switchDevMode(true);
  }
};
