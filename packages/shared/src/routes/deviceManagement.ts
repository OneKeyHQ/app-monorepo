export enum EModalDeviceManagementRoutes {
  GuideModal = 'GuideModal',
  DeviceListModal = 'DeviceListModal',
  DeviceDetailModal = 'DeviceDetailModal',
}

export type IModalDeviceManagementParamList = {
  [EModalDeviceManagementRoutes.GuideModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceListModal]: undefined;
  [EModalDeviceManagementRoutes.DeviceDetailModal]: {
    deviceId: string;
  };
};
