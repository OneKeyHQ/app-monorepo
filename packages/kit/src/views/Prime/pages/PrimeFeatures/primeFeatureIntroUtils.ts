import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import type { ImageSourcePropType } from 'react-native';
import type { ReactVideoSource } from 'react-native-video';

export type IPrimeFeatureIntroPosterSource = ImageSourcePropType | string;

export type IPrimeFeatureIntroMedia =
  | {
      type: 'video';
      getSource: () => ReactVideoSource;
      getPosterSource: () => IPrimeFeatureIntroPosterSource;
    }
  | {
      type: 'icon';
      icon: IKeyOfIcons;
    };

export type IPrimeFeatureIntroAction =
  | 'bulkSend'
  | 'bulkRevoke'
  | 'bulkCopyAddresses'
  | 'notifications'
  | 'receiveRiskMonitoring'
  | 'browser';

export type IPrimeFeatureIntro = {
  id: EPrimeFeatures;
  listIcon: IKeyOfIcons;
  title: ETranslations;
  description: ETranslations;
  descriptionValues?: Record<string, string | number>;
  media: IPrimeFeatureIntroMedia;
  details: {
    icon: IKeyOfIcons;
    title: ETranslations;
    description: ETranslations;
  }[];
  isComingSoon?: boolean;
  action?: IPrimeFeatureIntroAction;
  actionLabel?: ETranslations;
};

export type IPrimeFeatureIntroCtaKind =
  | 'subscribe'
  | 'featureAction'
  | 'comingSoon'
  | 'none';

const PRIME_FEATURE_VIDEO_CDN_BASE_URL =
  'https://asset.onekey-asset.com/app-monorepo/bb7a4e71aba56b405faf9278776d57d73b829708/static/media';

function getPrimeFeatureVideoSource(fileName: string): ReactVideoSource {
  return {
    uri: `${PRIME_FEATURE_VIDEO_CDN_BASE_URL}/${fileName}`,
  };
}

export const PRIME_FEATURE_INTROS: IPrimeFeatureIntro[] = [
  {
    id: EPrimeFeatures.BulkSend,
    listIcon: 'ChevronDoubleUpOutline',
    title: ETranslations.wallet_bulk_send_title,
    description: ETranslations.prime_bulk_send_desc,
    media: {
      type: 'video',
      getSource: () =>
        getPrimeFeatureVideoSource('prime-feature-bulk-send-20260529.mp4'),
      getPosterSource: () =>
        require('@onekeyhq/kit/assets/prime/bulk_send_poster.png') as ImageSourcePropType,
    },
    action: 'bulkSend',
    actionLabel: ETranslations.prime_feature_bulk_send_cta__action,
    details: [
      {
        icon: 'PeopleOutline',
        title: ETranslations.prime_features_bulk_send_one_title,
        description: ETranslations.prime_features_bulk_send_one_desc,
      },
      {
        icon: 'GasOutline',
        title: ETranslations.prime_features_bulk_send_two_title,
        description: ETranslations.prime_features_bulk_send_two_desc,
      },
      {
        icon: 'UploadOutline',
        title: ETranslations.prime_features_bulk_send_three_title,
        description: ETranslations.prime_features_bulk_send_three_desc,
      },
    ],
  },
  {
    id: EPrimeFeatures.ReceiveRiskMonitoring,
    listIcon: 'InboxOutline',
    title: ETranslations.prime_feature_receive_risk_monitoring__title,
    description: ETranslations.prime_feature_receive_risk_monitoring__desc,
    media: {
      type: 'video',
      getSource: () =>
        getPrimeFeatureVideoSource(
          'prime-feature-receive-risk-monitoring-20260601.mp4',
        ),
      getPosterSource: () =>
        require('@onekeyhq/kit/assets/prime/receive_risk_monitoring_poster.png') as ImageSourcePropType,
    },
    action: 'receiveRiskMonitoring',
    actionLabel:
      ETranslations.prime_feature_receive_risk_monitoring_cta__action,
    details: [],
  },
  {
    id: EPrimeFeatures.BulkRevoke,
    listIcon: 'FlashOutline',
    title: ETranslations.global_bulk_revoke,
    description: ETranslations.global_bulk_revoke_desc,
    media: {
      type: 'video',
      getSource: () =>
        getPrimeFeatureVideoSource('prime-feature-bulk-revoke-20260604.mp4'),
      getPosterSource: () =>
        require('@onekeyhq/kit/assets/prime/bulk_revoke_poster.png') as ImageSourcePropType,
    },
    action: 'bulkRevoke',
    actionLabel: ETranslations.wallet_approval_manage_title,
    details: [
      {
        icon: 'GasOutline',
        title: ETranslations.prime_features_bulk_revoke_detail_two_title,
        description: ETranslations.prime_features_bulk_revoke_detail_two_desc,
      },
      {
        icon: 'WalletCryptoOutline',
        title: ETranslations.prime_features_bulk_revoke_detail_one_title,
        description: ETranslations.prime_features_bulk_revoke_detail_one_desc,
      },
    ],
  },
  {
    id: EPrimeFeatures.BulkCopyAddresses,
    listIcon: 'Copy3Outline',
    title: ETranslations.global_bulk_copy_addresses,
    description: ETranslations.prime_bulk_copy_addresses_desc,
    media: {
      type: 'video',
      getSource: () =>
        getPrimeFeatureVideoSource(
          'prime-feature-bulk-copy-addresses-20260529.mp4',
        ),
      getPosterSource: () =>
        require('@onekeyhq/kit/assets/prime/bulk_copy_addresses_poster.png') as ImageSourcePropType,
    },
    action: 'bulkCopyAddresses',
    actionLabel: ETranslations.prime_feature_bulk_copy_cta__action,
    details: [
      {
        icon: 'OrganisationOutline',
        title: ETranslations.prime_features_bulk_copy_detail_one_title,
        description: ETranslations.prime_features_bulk_copy_detail_one_desc,
      },
      {
        icon: 'WalletCryptoOutline',
        title: ETranslations.prime_features_bulk_copy_detail_two_title,
        description: ETranslations.prime_features_bulk_copy_detail_two_desc,
      },
      {
        icon: 'DownloadOutline',
        title: ETranslations.prime_features_bulk_copy_detail_three_title,
        description: ETranslations.prime_features_bulk_copy_detail_three_desc,
      },
    ],
  },
  {
    id: EPrimeFeatures.DAppTranslate,
    listIcon: 'TranslateOutline',
    title: ETranslations.prime_ai_translate_title,
    description: ETranslations.prime_ai_translate_desc,
    media: {
      type: 'video',
      getSource: () =>
        getPrimeFeatureVideoSource('prime-feature-ai-translation-20260529.mp4'),
      getPosterSource: () =>
        require('@onekeyhq/kit/assets/prime/ai_translation_poster.png') as ImageSourcePropType,
    },
    action: 'browser',
    actionLabel: ETranslations.shortcuts_go_to_browser_tab,
    details: [
      {
        icon: 'AiStarOutline',
        title: ETranslations.prime_features_ai_translate_detail_one_title,
        description: ETranslations.prime_features_ai_translate_detail_one_desc,
      },
      {
        icon: 'SwitchHorOutline',
        title: ETranslations.prime_features_ai_translate_detail_two_title,
        description: ETranslations.prime_features_ai_translate_detail_two_desc,
      },
    ],
  },
  {
    id: EPrimeFeatures.BlockaidSiteScan,
    listIcon: 'ShieldCheckDoneOutline',
    title: ETranslations.prime_enhanced_dapp_security_title,
    description: ETranslations.prime_enhanced_dapp_security_desc,
    media: {
      type: 'video',
      getSource: () =>
        getPrimeFeatureVideoSource('prime-feature-dapp-security-20260529.mp4'),
      getPosterSource: () =>
        require('@onekeyhq/kit/assets/prime/dapp_security_poster.png') as ImageSourcePropType,
    },
    action: 'browser',
    actionLabel: ETranslations.shortcuts_go_to_browser_tab,
    details: [
      {
        icon: 'ShieldCheckDoneOutline',
        title: ETranslations.prime_features_dapp_security_detail_one_title,
        description: ETranslations.prime_features_dapp_security_detail_one_desc,
      },
      {
        icon: 'ShareOutline',
        title: ETranslations.prime_features_dapp_security_detail_two_title,
        description: ETranslations.prime_features_dapp_security_detail_two_desc,
      },
    ],
  },
  {
    id: EPrimeFeatures.Notifications,
    listIcon: 'BellOutline',
    title: ETranslations.global_multi_account_notification,
    description: ETranslations.global_on_chain_notifications_description,
    descriptionValues: {
      number: 100,
    },
    media: {
      type: 'icon',
      icon: 'BellSolid',
    },
    action: 'notifications',
    actionLabel: ETranslations.prime_feature_notifications_cta__action,
    details: [
      {
        icon: 'EyeOutline',
        title:
          ETranslations.prime_features_increase_notification_limit_one_title,
        description:
          ETranslations.prime_features_increase_notification_limit_one_desc,
      },
    ],
  },
  {
    id: EPrimeFeatures.HistoryExport,
    listIcon: 'ClockTimeHistoryOutline',
    title: ETranslations.global_export_transaction_history,
    description: ETranslations.wallet_export_on_chain_transactions_description,
    descriptionValues: {
      networkCount: 12,
    },
    media: {
      type: 'icon',
      icon: 'ClockTimeHistorySolid',
    },
    isComingSoon: true,
    details: [
      {
        icon: 'ArchiveBoxOutline',
        title: ETranslations.prime_features_export_transactions_one_title,
        description: ETranslations.prime_features_export_transactions_one_desc,
      },
      {
        icon: 'BillOutline',
        title: ETranslations.prime_features_export_transactions_two_title,
        description: ETranslations.prime_features_export_transactions_two_desc,
      },
    ],
  },
];

export function getPrimeFeatureIntro(featureId: EPrimeFeatures | undefined) {
  return PRIME_FEATURE_INTROS.find((feature) => feature.id === featureId);
}

export function getPrimeFeatureIntroCtaKind({
  featureId,
  isPrimeSubscriptionActive,
}: {
  featureId: EPrimeFeatures | undefined;
  isPrimeSubscriptionActive: boolean;
}): IPrimeFeatureIntroCtaKind {
  const feature = getPrimeFeatureIntro(featureId);
  if (!feature) {
    return 'none';
  }
  if (!isPrimeSubscriptionActive) {
    return 'subscribe';
  }
  if (feature.isComingSoon) {
    return 'comingSoon';
  }
  return 'featureAction';
}
