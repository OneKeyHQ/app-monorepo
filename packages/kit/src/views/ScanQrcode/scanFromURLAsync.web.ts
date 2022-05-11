import jsQR from 'jsqr';

async function getImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve) => {
    const img = new Image();

    img.crossOrigin = 'anonymous';

    img.onload = function () {
      const { width } = img;
      const { height } = img;
      const actualWidth = Math.min(960, width);
      const actualHeight = height * (actualWidth / width);

      const canvas = document.createElement('canvas');
      canvas.width = actualWidth;
      canvas.height = actualHeight;

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
  const { data, width, height } = await getImageData(base64Url);
  const decoded = jsQR(data, width, height, {
    inversionAttempts: 'dontInvert',
  });
  return decoded?.data;
}
