declare module 'node-notifier' {
  interface INotificationOptions {
    title?: string;
    message?: string;
    icon?: string;
    sound?: boolean | string;
    wait?: boolean;
    timeout?: number | false;
  }

  interface INodeNotifier {
    notify(message: string | INotificationOptions): void;
  }

  const notifier: INodeNotifier;
  export default notifier;
}
