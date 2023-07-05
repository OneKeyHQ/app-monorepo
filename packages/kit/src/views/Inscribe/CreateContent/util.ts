export function calculateByteLength(str: string) {
  const encoder = new TextEncoder(); // 创建一个文本编码器对象
  const buf = encoder.encode(str); // 将字符串编码为ArrayBuffer对象
  return buf.byteLength; // 读取ArrayBuffer字节长度，即为字符串字节数
}
