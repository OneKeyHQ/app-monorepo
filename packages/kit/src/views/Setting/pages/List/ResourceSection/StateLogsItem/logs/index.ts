import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export const exportLogs = async (filename: string) => {
  const logName = `${filename}.txt`;
  const allMsgs = await backgroundApiProxy.serviceLogger.getAllMsg();
  const element = document.createElement('a');
  const file = new Blob(allMsgs, {
    type: 'text/plain',
    endings: 'native',
  });
  element.href = URL.createObjectURL(file);
  element.download = logName;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
};
