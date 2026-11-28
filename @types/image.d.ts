declare module '*.png' {
  type IImageRequireSource = number;
  const value: IImageRequireSource;
  export default value;
}

declare module '*.webp' {
  type IImageRequireSource = number;
  const value: IImageRequireSource;
  export default value;
}

declare module '*.css';

declare module '*.bin' {
  type IBinaryRequireSource = number;
  const value: IBinaryRequireSource;
  export default value;
}
