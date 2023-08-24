export enum PasswordRoutes {
  PasswordRoutes = 'PasswordRoutes',
}

export type PasswordRoutesParams = {
  [PasswordRoutes.PasswordRoutes]: {
    onSuccess?: () => void;
  };
};
