import { InteractionManager } from 'react-native';

import CreateAvatarListWorker from './createAvatarList.worker.js';

export default function makeBlockieImageUriList(idList: string[]) {
  // @ts-expect-error
  const worker = new CreateAvatarListWorker() as Worker;
  return new Promise<string[]>((resolve) => {
    worker.onmessage = (event) => {
      void InteractionManager.runAfterInteractions(() => resolve(event.data));
      worker.terminate();
    };
    worker.postMessage(idList);
  });
}
