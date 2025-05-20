import * as ethUtils from 'ethereumjs-util';

export function autoFixPersonalSignMessage({ message }: { message: string }) {
  let messageFixed = message;
  try {
    ethUtils.toBuffer(message);
  } catch (error) {
    const tmpMsg = `0x${message}`;
    try {
      ethUtils.toBuffer(tmpMsg);
      messageFixed = tmpMsg;
    } catch (err) {
      // message not including valid hex character
    }
  }
  return messageFixed;
}
