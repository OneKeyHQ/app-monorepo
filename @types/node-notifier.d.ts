declare module 'node-notifier' {
  interface NotificationOptions {
    title?: string;
    message?: string;
    icon?: string;
    sound?: boolean | string;
    wait?: boolean;
    timeout?: number | false;
  }

  interface NodeNotifier {
    notify(message: string | NotificationOptions): void;
  }

  const notifier: NodeNotifier;
  export default notifier;
}
