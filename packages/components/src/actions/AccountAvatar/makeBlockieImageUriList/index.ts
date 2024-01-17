import CreateAvatarListWorker from './createAvatarList.worker.js';

// @ts-expect-error
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const worker = new CreateAvatarListWorker() as Worker;

const events = new Map<string, (data: string) => void>();

worker.onmessage = (event: MessageEvent<{ id: string; data: string }>) => {
  const { id, data } = event.data;
  const callback = events.get(id);
  if (callback) {
    callback(data);
    events.delete(id);
  }
};

export default function makeBlockieImageUri(id: string) {
  return new Promise<string>((resolve) => {
    events.set(id, resolve);
    worker.postMessage(id);
  });
}
