import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDeFiAsset, IDeFiProtocol } from '@onekeyhq/shared/types/defi';

import { getCategoryConfig } from './defiCategoryConfig';

const POSITION_ASSET_SECTION_LABELS: Record<
  string,
  { title: string; titleId?: ETranslations }
> = {
  lending: { title: 'Collateral' },
  yield: { title: 'Supply', titleId: ETranslations.defi_supply },
  liquidity: { title: 'Liquidity', titleId: ETranslations.global_liquidity },
  supplied: { title: 'Supply', titleId: ETranslations.defi_supply },
  deposit: { title: 'Deposit', titleId: ETranslations.earn_deposit },
  borrowed: {
    title: 'Borrowed',
    titleId: ETranslations.wallet_defi_asset_type_borrowed,
  },
  locked: {
    title: 'Locked',
    titleId: ETranslations.wallet_defi_position_module_locked,
  },
  rewards: { title: 'Rewards', titleId: ETranslations.earn_rewards },
  staking: { title: 'Staked', titleId: ETranslations.earn_staked },
  farming: { title: 'Deposit', titleId: ETranslations.earn_deposit },
};

export type IProtocolPositionSection = {
  key: string;
  title: string;
  titleId?: ETranslations;
  assets: IDeFiAsset[];
};

export type IProtocolPositionItem = {
  groupId: string;
  category: string;
  categoryConfig: ReturnType<typeof getCategoryConfig>;
  poolName?: string;
  poolFullName?: string;
  value: string;
  sections: IProtocolPositionSection[];
};

function getPositionAssetSectionLabel(category: string) {
  return (
    POSITION_ASSET_SECTION_LABELS[category.toLowerCase()] ?? {
      title: category,
    }
  );
}

function buildProtocolPositionItems(protocol: IDeFiProtocol) {
  return protocol.positions.map<IProtocolPositionItem>((position) => {
    const categoryConfig = getCategoryConfig(position.category);
    const assetSectionLabel = getPositionAssetSectionLabel(position.category);

    return {
      groupId: position.groupId,
      category: position.category,
      categoryConfig,
      poolName: position.poolName,
      poolFullName: position.poolFullName,
      value: position.value,
      sections: [
        {
          key: `${position.groupId}-assets`,
          title: assetSectionLabel.title,
          titleId: assetSectionLabel.titleId,
          assets: position.assets,
        },
        {
          key: `${position.groupId}-debts`,
          title: 'Borrow',
          titleId: ETranslations.global_borrow,
          assets: position.debts,
        },
        {
          key: `${position.groupId}-rewards`,
          title: 'Rewards',
          titleId: ETranslations.earn_rewards,
          assets: position.rewards,
        },
      ].filter((section) => section.assets.length > 0),
    };
  });
}

export { buildProtocolPositionItems, getPositionAssetSectionLabel };
