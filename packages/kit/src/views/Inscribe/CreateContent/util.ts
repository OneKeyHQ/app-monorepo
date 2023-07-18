export function calculateByteLength(str: string) {
  const encoder = new TextEncoder(); // 创建一个文本编码器对象
  const buf = encoder.encode(str); // 将字符串编码为ArrayBuffer对象
  return buf.byteLength; // 读取ArrayBuffer字节长度，即为字符串字节数
}

export function checkFileSize(byteSize: number) {
  const maxFileSize = 1024 * 200;

  if (byteSize > 0 && byteSize <= maxFileSize) {
    return true;
  }
  return false;
}
