export type IPhotoSavePermission = {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
};

export type IPickedPhoto =
  | { canceled: true }
  | { canceled: false; uri: string };
