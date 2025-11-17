declare module 'react-native-ping' {
  interface IPingOptions {
    timeout?: number;
    interval?: number;
  }

  const Ping: {
    start: (target: string, options?: IPingOptions) => Promise<number>;
  };

  export default Ping;
}
