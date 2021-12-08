import createJsBridgeBase from './createJsBridgeBase';
import { ICreateJsBridgeParams, IJsBridge } from '../types';

function createJsBridgeInpage({
  sendPayload = () => {},
  sendAsString = true,
}: ICreateJsBridgeParams): IJsBridge {
  return createJsBridgeBase({ sendPayload, sendAsString });
}

export default createJsBridgeInpage;
