// App commands of the iPadOS menu bar that JS performs.
export type IMainMenuCommand = 'about' | 'preferences' | 'lockNow';

export type IMainMenuConfig = {
  aboutTitle: string;
  preferencesTitle: string;
  lockNowTitle: string;
  // Opened natively in the system browser.
  helpLinks: { title: string; url: string }[];
};

export type IMainMenu = {
  setConfig: (config: IMainMenuConfig) => void;
  // Returns the unsubscribe function.
  addCommandListener: (
    callback: (command: IMainMenuCommand) => void,
  ) => () => void;
};
