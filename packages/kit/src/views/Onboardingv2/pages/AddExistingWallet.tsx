import { useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Dialog, Icon, Page, SizableText, YStack } from '@onekeyhq/components';
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
import { showPrimeTransferImportProcessingDialog } from '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog';
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

  const { checkLoading, supportCloudBackup, goToPageBackupList, startBackup } =
    useCloudBackup();

  const { result: cloudBackupOption = null } =
    usePromiseResult<IAddExistingWalletOption | null>(async () => {
      if (!supportCloudBackup) {
        return null;
      }
      noop(navigation);
      const info =
        await backgroundApiProxy.serviceCloudBackupV2.getBackupProviderInfo();

      const option: IAddExistingWalletOption = {
        icon: 'CloudOutline',
        title: info.displayNameI18nKey
          ? intl.formatMessage({
              id: info.displayNameI18nKey as any,
            })
          : info.displayName,
        onPress: goToPageBackupList,
        // onPress: () => navigation.push(EOnboardingPagesV2.ICloudBackup),
      };
      return option;
    }, [goToPageBackupList, intl, navigation, supportCloudBackup]);
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
          },
        },
        {
          title: 'OneKey KeyTag',
          icon: 'OnekeyKeytagOutline' as IKeyOfIcons,
          onPress: async () => {
            await backgroundApiProxy.servicePassword.promptPasswordVerify();
            defaultLogger.setting.page.keyTagImport();
            navigation.pushModal(EModalRoutes.OnboardingModal, {
              screen: EOnboardingPages.ImportKeyTag,
            });
          },
        },
        platformEnv.isNative
          ? {
              title: 'OneKey Lite',
              icon: 'OnekeyLiteOutline' as IKeyOfIcons,
              onPress: async () => {
                await liteCard.importWallet();
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
        },
        ...(() => {
          return [
            ...(supportCloudBackup
              ? [
                  {
                    title: '===DEBUG===BackupNow',
                    icon: 'StorageOutline',
                    onPress: startBackup,
                    isLoading: checkLoading,
                  },
                  {
                    title: '===DEBUG===GetCloudAccountInfo',
                    icon: 'StorageOutline',
                    onPress: async () => {
                      const info =
                        await backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
                      Dialog.debugMessage({
                        debugMessage: info,
                      });
                    },
                  },
                  {
                    title: '===DEBUG===LoginCloudIfNeed',
                    icon: 'StorageOutline',
                    onPress: async () => {
                      await backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
                    },
                  },
                  {
                    title: '===DEBUG===LogoutCloud',
                    icon: 'StorageOutline',
                    onPress: async () => {
                      await backgroundApiProxy.serviceCloudBackupV2.logoutCloud();
                    },
                  },
                ]
              : []),
          ].filter(Boolean);
        })(),
      ].filter(Boolean),
    [
      intl,
      cloudBackupOptionWithLoading,
      navigation,
      isSoftwareWalletOnlyUser,
      liteCard,
      supportCloudBackup,
      startBackup,
      checkLoading,
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
                <SizableText size="$bodyMdMedium">{title}</SizableText>
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
