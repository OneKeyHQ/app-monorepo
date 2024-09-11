export type IDemoNotificationSdk = {
  init: () => Promise<void>;
  showNotification: (params: {
    title: string;
    content: string;
    uuid: string;
  }) => Promise<void>;
};
