import { ModalAssetDetailsStack } from '../../views/AssetDetails/router';
import { ModalAssetListStack } from '../../views/AssetList/router';

export const ModalMainStack = [
  ...ModalAssetListStack,
  ...ModalAssetDetailsStack,
];
