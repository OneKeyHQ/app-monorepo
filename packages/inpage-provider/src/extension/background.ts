import JsBridgeExtBackground from '../jsBridge/JsBridgeExtBackground';
import { IJsBridgeReceiveHandler } from '../types';

function createHostBridge({
  receiveHandler,
}: {
  receiveHandler: IJsBridgeReceiveHandler;
}) {
  const bridge = new JsBridgeExtBackground({
    receiveHandler,
  });
  return bridge;
}

export default {
  createHostBridge,
};
