declare module 'react-native-ping' {
  interface IPingOptions {
    timeout?: number;
    payloadSize?: number;
  }

  export const Ping: {
    start: (target: string, options: IPingOptions) => Promise<number>;
  };
}
