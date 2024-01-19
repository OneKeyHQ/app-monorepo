import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import ConnectionModal from '../pages/ConnectionModal';

export enum EDAppConnectionModal {
  'ConnectionModal' = 'ConnectionModal',
}

export type IDAppConnectionModalParamList = {
  [EDAppConnectionModal.ConnectionModal]: undefined;
};

export const DAppConnectionRouter: IModalFlowNavigatorConfig<
  EDAppConnectionModal,
  IDAppConnectionModalParamList
>[] = [
  {
    name: EDAppConnectionModal.ConnectionModal,
    component: ConnectionModal,
  },
];
