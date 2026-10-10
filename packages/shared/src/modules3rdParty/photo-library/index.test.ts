/** @jest-environment jsdom */

import PhotoLibrary from '.';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));

let chooser: HTMLInputElement;
const originalAddEventListener = globalThis.addEventListener;

beforeEach(() => {
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
  jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
    const input = document.querySelector<HTMLInputElement>('input[type=file]');
    if (input) chooser = input;
  });
});

afterEach(() => {
  globalThis.addEventListener = originalAddEventListener;
  jest.restoreAllMocks();
});

it('settles cancellation and removes the mounted chooser', async () => {
  const result = PhotoLibrary.pickImage();
  chooser.dispatchEvent(new Event('cancel'));
  await expect(result).resolves.toEqual({ canceled: true });
  expect(document.querySelector('input[type=file]')).toBeNull();
});

it('returns the exact selected file as a data URL', async () => {
  const result = PhotoLibrary.pickImage();
  const file = new File(['original QR bytes'], 'qr.png', { type: 'image/png' });
  Object.defineProperty(chooser, 'files', { value: [file] });
  chooser.dispatchEvent(new Event('change'));
  await expect(result).resolves.toEqual({
    canceled: false,
    uri: `data:image/png;base64,${btoa('original QR bytes')}`,
  });
  expect(document.querySelector('input[type=file]')).toBeNull();
});

it('settles older-browser cancellation on return to the window', async () => {
  jest.useFakeTimers();
  const result = PhotoLibrary.pickImage();
  globalThis.dispatchEvent(new Event('focus'));
  jest.runAllTimers();
  await expect(result).resolves.toEqual({ canceled: true });
  jest.useRealTimers();
});
