import utils from './utils';

export function prepareLoggerExport(): void {
  utils.flushPendingRepeat();
}
