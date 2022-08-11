/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

export function isAvailable(): Promise<boolean> {
  return Promise.resolve(false);
}

export function sync(): Promise<boolean> {
  return Promise.resolve(true);
}

export function listFiles(_target: string): Promise<Array<string>> {
  return Promise.resolve([]);
}

export function deleteFile(_target: string): Promise<boolean> {
  return Promise.resolve(false);
}

export function downloadFromCloud(_filename: string): Promise<string> {
  return Promise.resolve('');
}

export function uploadToCloud(_source: string, _target: string): Promise<void> {
  return Promise.resolve();
}
