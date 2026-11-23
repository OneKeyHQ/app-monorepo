/** @jest-environment jsdom */

import { cleanSupportImage, pickSupportImage } from './pickSupportImage';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

let input: HTMLInputElement;
let image: HTMLImageElement;
let canvas: HTMLCanvasElement;
const drawImage = jest.fn();
const fillRect = jest.fn();
const createObjectURL = jest.fn();
const revokeObjectURL = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  input = document.createElement('input');
  image = document.createElement('img');
  canvas = document.createElement('canvas');
  Object.defineProperties(image, {
    naturalWidth: { value: 8000 },
    naturalHeight: { value: 4000 },
  });
  Object.defineProperty(canvas, 'getContext', {
    value: () => ({ drawImage, fillRect, fillStyle: '' }),
  });
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: createObjectURL },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  createObjectURL
    .mockReturnValueOnce('blob:original')
    .mockReturnValue('blob:encoded');
  jest.spyOn(globalThis, 'Image').mockImplementation(() => image);
  jest.spyOn(input, 'click').mockImplementation(() => {});
  const createElement = (name: string) => (name === 'input' ? input : canvas);
  jest
    .spyOn(document, 'createElement')
    .mockImplementation(createElement as typeof document.createElement);
});
afterEach(() => jest.restoreAllMocks());

function select(file: File) {
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
}

it.each(['image/jpeg', 'image/heic', 'image/png'])(
  'uploads newly encoded pixels for %s and releases both temporary URLs',
  async (sourceMime) => {
    const mime = sourceMime === 'image/png' ? 'image/png' : 'image/jpeg';
    const extension = mime === 'image/png' ? 'png' : 'jpg';
    const original = new File(['Exif\0\0GPS-original-metadata'], 'photo.heic', {
      type: sourceMime,
    });
    const encoded = new Blob(['encoded-pixels'], { type: mime });
    const toBlob = jest
      .spyOn(canvas, 'toBlob')
      .mockImplementation((callback) => callback(encoded));
    const picking = pickSupportImage();
    select(original);
    image.dispatchEvent(new Event('load'));
    const result = await picking;
    expect(result).toEqual({
      path: 'blob:encoded',
      mime,
      size: encoded.size,
      width: 4096,
      height: 2048,
      filename: `photo.${extension}`,
      blob: encoded,
    });
    expect(result?.blob).not.toBe(original);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 4096, 2048);
    expect(fillRect).toHaveBeenCalledTimes(mime === 'image/png' ? 0 : 1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), mime, 0.9);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:original');
    await cleanSupportImage(result?.path ?? '');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:encoded');
  },
);

it.each(['decode', 'encode'])(
  'releases the original URL and reports %s failures',
  async (failure) => {
    jest
      .spyOn(canvas, 'toBlob')
      .mockImplementation((callback) => callback(null));
    const picking = pickSupportImage();
    select(new File(['invalid-image'], 'photo.jpg', { type: 'image/jpeg' }));
    image.dispatchEvent(new Event(failure === 'decode' ? 'error' : 'load'));
    await expect(picking).rejects.toThrow(/support image/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:original');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  },
);

it('rejects an oversized source before decoding and resolves a canceled selection', async () => {
  const oversized = new File(['image'], 'large.jpg', { type: 'image/jpeg' });
  Object.defineProperty(oversized, 'size', { value: 20 * 1024 * 1024 + 1 });
  const picking = pickSupportImage();
  select(oversized);
  await expect(picking).rejects.toThrow('smaller than 20 MB');
  expect(createObjectURL).not.toHaveBeenCalled();
  const canceled = pickSupportImage();
  input.dispatchEvent(new Event('cancel'));
  await expect(canceled).resolves.toBeUndefined();
});
