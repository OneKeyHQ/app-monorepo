import createJsBridgeBase from './createJsBridgeBase';
import { ICreateJsBridgeParams, IJsBridge } from '../types';

function createJsBridgeInpage({
  sendPayload = () => {},
}: ICreateJsBridgeParams): IJsBridge {
  return createJsBridgeBase({ sendPayload });
}

export default createJsBridgeInpage;
