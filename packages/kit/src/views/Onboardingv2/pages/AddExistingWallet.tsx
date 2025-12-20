import { useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, Page, SizableText, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
} from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import useLiteCard from '../../LiteCard/hooks/useLiteCard';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useCloudBackup } from '../hooks/useCloudBackup';

type IAddExistingWalletOption = {
  title: string;
  icon: IKeyOfIcons;
  description?: string | string[];
  isLoading?: boolean;
  onPress?: () => Promise<void>;
};

export default function AddExistingWallet() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const {
    checkLoading,
    supportCloudBackup,
    goToPageBackupList,
    cloudBackupFeatureInfo,
  } = useCloudBackup();

  const { result: cloudBackupOption = null } =
    usePromiseResult<IAddExistingWalletOption | null>(async () => {
      if (!supportCloudBackup || !cloudBackupFeatureInfo) {
        return null;
      }
      noop(navigation);

      const option: IAddExistingWalletOption = {
        icon: cloudBackupFeatureInfo?.icon as IKeyOfIcons,
        title: cloudBackupFeatureInfo?.title,
        onPress: goToPageBackupList,
        // onPress: () => navigation.push(EOnboardingPagesV2.ICloudBackup),
      };
      return option;
    }, [
      cloudBackupFeatureInfo,
      goToPageBackupList,
      navigation,
      supportCloudBackup,
    ]);
  const cloudBackupOptionWithLoading =
    useMemo<IAddExistingWalletOption | null>(() => {
      if (!cloudBackupOption) {
        return null;
      }
      // navigation.push(EOnboardingPagesV2.ICloudBackup);
      return {
        ...cloudBackupOption,
        isLoading: checkLoading,
      };
    }, [cloudBackupOption, checkLoading]);
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const liteCard = useLiteCard();

  const DATA: IAddExistingWalletOption[] = useMemo(
    () =>
      [
        {
          title: intl.formatMessage({ id: ETranslations.global_transfer }),
          icon: 'MultipleDevicesOutline' as IKeyOfIcons,
          description: intl.formatMessage({
            id: ETranslations.prime_transfer_desc,
          }),
          onPress: () => {
            navigation?.pushModal(EModalRoutes.PrimeModal, {
              screen: EPrimePages.PrimeTransfer,
            });
            defaultLogger.account.wallet.addWalletStarted({
              addMethod: 'ImportWallet',
              details: {
                importType: 'transfer',
              },
              isSoftwareWalletOnlyUser,
            });
          },
        },
        {
          title: intl.formatMessage({
            id: ETranslations.import_phrase_or_private_key,
          }),
          icon: 'SecretPhraseOutline' as IKeyOfIcons,
          onPress: () => {
            navigation.push(EOnboardingPagesV2.ImportPhraseOrPrivateKey);

            defaultLogger.account.wallet.addWalletStarted({
              addMethod: 'ImportWallet',
              details: {
                importType: 'importPhraseOrPrivateKey',
              },
              isSoftwareWalletOnlyUser,
            });
          },
        },
        {
          title: 'OneKey KeyTag',
          icon: 'OnekeyKeytagOutline' as IKeyOfIcons,
          onPress: async () => {
            await backgroundApiProxy.servicePassword.promptPasswordVerify();
            navigation.pushModal(EModalRoutes.OnboardingModal, {
              screen: EOnboardingPages.ImportKeyTag,
            });
            defaultLogger.account.wallet.addWalletStarted({
              addMethod: 'ImportWallet',
              details: {
                importType: 'keyTag',
              },
              isSoftwareWalletOnlyUser,
            });
          },
        },
        platformEnv.isNative
          ? {
              title: 'OneKey Lite',
              icon: 'OnekeyLiteOutline' as IKeyOfIcons,
              onPress: async () => {
                await liteCard.importWallet();
                defaultLogger.account.wallet.addWalletStarted({
                  addMethod: 'ImportWallet',
                  details: {
                    importType: 'lite',
                  },
                  isSoftwareWalletOnlyUser,
                });
              },
            }
          : undefined,
        cloudBackupOptionWithLoading,
        {
          title: intl.formatMessage({
            id: ETranslations.global_watch_only_address,
          }),
          icon: 'EyeOutline' as IKeyOfIcons,
          description: [
            `👀 ${intl.formatMessage({
              id: ETranslations.watch_only_desc_transactions,
            })}`,
            `🙅 ${intl.formatMessage({
              id: ETranslations.watch_only_desc_manage,
            })}`,
          ],
          onPress: () => {
            // V1 import address or public key
            navigation.pushModal(EModalRoutes.OnboardingModal, {
              screen: EOnboardingPages.ImportAddress,
              params: {
                isFromOnboardingV2: true,
              },
            });

            // V2 import address or public key
            // navigation.push(EOnboardingPagesV2.ImportWatchedAccount);
          },
        },
      ].filter(Boolean),
    [
      intl,
      cloudBackupOptionWithLoading,
      navigation,
      isSoftwareWalletOnlyUser,
      liteCard,
    ],
  );

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.add_existing_wallet_title,
          })}
        />
        <OnboardingLayout.Body>
          {DATA.map(({ title, icon, description, onPress, isLoading }) => (
            <ListItem
              key={title}
              gap="$3"
              bg="$bg"
              $platform-web={{
                boxShadow:
                  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              }}
              $theme-dark={{
                bg: '$neutral2',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$neutral3',
              }}
              $platform-native={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$borderSubdued',
              }}
              borderRadius="$5"
              borderCurve="continuous"
              p="$3"
              m="$0"
              onPress={onPress}
              isLoading={isLoading}
              userSelect="none"
            >
              <YStack
                borderRadius="$2"
                borderCurve="continuous"
                bg="$neutral2"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$neutral2"
                p="$2"
              >
                <Icon name={icon} />
              </YStack>
              <YStack gap={2} flex={1}>
                <SizableText
                  size="$bodyMdMedium"
                  $platform-native={{
                    size: '$bodyLgMedium',
                  }}
                >
                  {title}
                </SizableText>
                {description ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {Array.isArray(description)
                      ? description.join('\n')
                      : description}
                  </SizableText>
                ) : null}
              </YStack>
              {isLoading ? null : (
                <Icon name="ChevronRightSmallOutline" color="$iconDisabled" />
              )}
            </ListItem>
          ))}
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
