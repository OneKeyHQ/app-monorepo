declare module '*.png' {
  type IImageRequireSource = number;
  const value: IImageRequireSource;
  export default value;
}
