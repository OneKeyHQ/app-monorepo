/** @jest-environment jsdom */

import { downloadAsFile } from './downloadAsFile';

it('downloads decoded ZIP bytes and releases the object URL', async () => {
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x80]);
  const createObjectURL = jest.fn((_blob: Blob) => 'blob:test-zip');
  const revokeObjectURL = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    configurable: true,
  });
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  try {
    await downloadAsFile({
      content: bytes.toString('base64'),
      filename: 'backup.zip',
      encoding: 'base64',
      mimeType: 'application/zip',
    });
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/zip');
    const exported = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    expect(Buffer.from(exported)).toEqual(bytes);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-zip');
    expect(document.querySelector('a')).toBeNull();
  } finally {
    click.mockRestore();
  }
});
