import type { IDeFiAsset, IDeFiProtocol } from '@onekeyhq/shared/types/defi';

import { getCategoryConfig, getCategoryLabel } from './defiCategoryConfig';

const POSITION_ASSET_SECTION_LABELS: Record<string, string> = {
  lending: 'Collateral',
  yield: 'Supply',
  liquidity: 'Liquidity',
  supplied: 'Supply',
  deposit: 'Deposit',
  borrowed: 'Borrowed',
  locked: 'Locked',
  rewards: 'Rewards',
  staking: 'Staked',
  farming: 'Deposit',
};

export type IProtocolPositionSection = {
  key: string;
  title: string;
  assets: IDeFiAsset[];
};

export type IProtocolPositionItem = {
  groupId: string;
  categoryConfig: ReturnType<typeof getCategoryConfig>;
  categoryLabel: string;
  poolName?: string;
  poolFullName?: string;
  value: string;
  sections: IProtocolPositionSection[];
};

function getPositionAssetSectionLabel(category: string) {
  return (
    POSITION_ASSET_SECTION_LABELS[category.toLowerCase()] ??
    getCategoryLabel(category)
  );
}

function buildProtocolPositionItems(protocol: IDeFiProtocol) {
  return protocol.positions.map<IProtocolPositionItem>((position) => {
    const categoryConfig = getCategoryConfig(position.category);

    return {
      groupId: position.groupId,
      categoryConfig,
      categoryLabel: getCategoryLabel(position.category),
      poolName: position.poolName,
      poolFullName: position.poolFullName,
      value: position.value,
      sections: [
        {
          key: `${position.groupId}-assets`,
          title: getPositionAssetSectionLabel(position.category),
          assets: position.assets,
        },
        {
          key: `${position.groupId}-debts`,
          title: 'Borrow',
          assets: position.debts,
        },
        {
          key: `${position.groupId}-rewards`,
          title: 'Rewards',
          assets: position.rewards,
        },
      ].filter((section) => section.assets.length > 0),
    };
  });
}

export { buildProtocolPositionItems, getPositionAssetSectionLabel };
