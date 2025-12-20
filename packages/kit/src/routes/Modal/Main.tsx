import { ModalAssetDetailsStack } from '../../views/AssetDetails/router';
import { ModalAssetListStack } from '../../views/AssetList/router';
import { urlAccountRoutes } from '../../views/Home/router';
import { RewardCenterStack } from '../../views/RewardCenter/router';

export const ModalMainStack = [
  ...ModalAssetListStack,
  ...ModalAssetDetailsStack,
  ...urlAccountRoutes,
  ...RewardCenterStack,
];
