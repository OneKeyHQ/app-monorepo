export function getStandardFileBase64(
  base64Data: string,
  mimeType: string | null,
) {
  // 解码 base64 数据
  const binaryData = Buffer.from(base64Data, 'base64');

  // 检查二进制数据的头部信息是否为图片
  const isImage =
    mimeType &&
    (mimeType.startsWith('image/') || mimeType.startsWith('video/')) &&
    binaryData[0] === 0xff &&
    binaryData[1] === 0xd8 &&
    binaryData[binaryData.length - 2] === 0xff &&
    binaryData[binaryData.length - 1] === 0xd9;

  if (!isImage) {
    // 如果不是图片，直接返回输入的 base64 数据
    return base64Data;
  }

  // 如果是图片，添加标准的图片 MIME 类型信息，并返回标准的图片 base64 数据
  const standardBase64 = `data:${mimeType};base64,${base64Data}`;
  return standardBase64;
}
