async function getImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve) => {
    const img = new Image();

    img.crossOrigin = 'anonymous';

    img.onload = function () {
      const width = img.width || img.naturalWidth || 150;
      const height = img.height || img.naturalHeight || 150;
      const actualWidth = Math.min(960, width);
      const actualHeight = height * (actualWidth / width);

      const canvas = document.createElement('canvas');
      canvas.width = actualWidth;
      canvas.height = actualHeight;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const context = canvas.getContext('2d')!;
      context.drawImage(
        img,
        0,
        0,
        width,
        height,
        0,
        0,
        actualWidth,
        actualHeight,
      );

      resolve(context.getImageData(0, 0, actualWidth, actualHeight));
    };

    img.src = dataUrl;
  });
}

export async function scanFromURLAsync(base64Url: string) {
  const imgData = await getImageData(base64Url);
  const { scanImageData } = require('zbar.wasm') as typeof import('zbar.wasm');

  const res = await scanImageData(imgData);
  return res[0].decode();
}
