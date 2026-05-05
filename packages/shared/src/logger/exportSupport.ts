import utils from './utils';

export async function prepareLoggerExport(): Promise<void> {
  await utils.flushPendingRepeat();
}
