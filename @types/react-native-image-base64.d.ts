declare module 'react-native-image-base64' {
  type IRNImgToBase64 = {
    getBase64String(uri: string): Promise<string>;
  };
  const obj: IRNImgToBase64;
  export default obj;
}
