import { type ComponentProps, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { PROTOCOL_V2_DEVICE_LABEL_MAX_LENGTH } from '@onekeyhq/shared/src/utils/stringUtils';

import { AccountManagerTestIDs } from '../../testIDs';

import { showLabelSetDialog as showHardwareLabelSetDialog } from './HardwareLabelSetDialog';

export function WalletRenameButton({
  wallet,
  editable,
  nativeSheet = false,
  textSize = '$bodyLgMedium',
  ...rest
}: ComponentProps<typeof XStack> & {
  wallet: IDBWallet;
  editable: boolean | undefined;
  nativeSheet?: boolean;
  textSize?: '$bodyLgMedium' | '$heading2xl' | '$headingXl' | '$headingLg';
}) {
  const { serviceAccount } = backgroundApiProxy;
  const intl = useIntl();

  const canRename = useMemo(() => {
    if (accountUtils.isOthersWallet({ walletId: wallet?.id || '' })) {
      return false;
    }
    return !!editable;
  }, [editable, wallet?.id]);

  // Local wallet names must not trigger unsupported device-label writes.
  const shouldUseDbOnlyWalletRename = useMemo(() => {
    const vendor = wallet?.associatedDeviceInfo?.vendor;
    if (!vendor) return false;
    const profile = getVendorProfile(vendor);
    return profile.presentation.label.mode === 'local';
  }, [wallet?.associatedDeviceInfo?.vendor]);

  const labelAsciiOnly = useMemo(() => {
    const { label } = getVendorProfile(
      wallet?.associatedDeviceInfo?.vendor,
    ).presentation;
    return (
      isProtocolV2ProductType(wallet?.associatedDeviceInfo?.deviceType) ||
      (label.mode === 'device' && label.asciiOnly)
    );
  }, [
    wallet?.associatedDeviceInfo?.deviceType,
    wallet?.associatedDeviceInfo?.vendor,
  ]);

  const labelAsciiAlphanumericWithSpacesOnly = useMemo(
    () => isProtocolV2ProductType(wallet?.associatedDeviceInfo?.deviceType),
    [wallet?.associatedDeviceInfo?.deviceType],
  );

  return (
    <>
      <XStack
        testID={AccountManagerTestIDs.walletRenameButton}
        py="$1"
        px="$1.5"
        flexShrink={1}
        minWidth={0}
        alignItems="center"
        borderRadius="$2"
        {...(canRename && {
          role: 'button',
          onPress: async () => {
            if (
              wallet &&
              wallet?.id &&
              accountUtils.isHwWallet({ walletId: wallet?.id }) &&
              !accountUtils.isHwHiddenWallet({
                wallet,
              }) &&
              !shouldUseDbOnlyWalletRename
            ) {
              void showHardwareLabelSetDialog(
                {
                  wallet,
                  intl,
                  asciiOnly: labelAsciiOnly,
                },
                {
                  nativeSheet,
                  maxLength: labelAsciiAlphanumericWithSpacesOnly
                    ? PROTOCOL_V2_DEVICE_LABEL_MAX_LENGTH
                    : undefined,
                  disabledMaxLengthLabel: !labelAsciiAlphanumericWithSpacesOnly,
                  trimOuterWhitespace: labelAsciiAlphanumericWithSpacesOnly,
                  description: labelAsciiAlphanumericWithSpacesOnly
                    ? intl.formatMessage({
                        id: ETranslations.hardware_label_allowed_characters__desc,
                      })
                    : undefined,
                  onSubmit: async (name) => {
                    await backgroundApiProxy.serviceHardware.setDeviceLabel({
                      walletId: wallet?.id || '',
                      label: labelAsciiAlphanumericWithSpacesOnly
                        ? name.trim()
                        : name,
                    });
                  },
                },
              );
            } else {
              showRenameDialog(wallet.name, {
                nativeSheet,
                intl,
                nameHistoryInfo: {
                  entityId: wallet.id,
                  entityType: EChangeHistoryEntityType.Wallet,
                  contentType: EChangeHistoryContentType.Name,
                },
                disabledMaxLengthLabel: true,
                inputTestID: AccountManagerTestIDs.walletRenameInput,
                confirmTestID: AccountManagerTestIDs.walletRenameConfirm,
                onSubmit: async (name) => {
                  if (wallet?.id && name) {
                    if (accountUtils.isBotWallet({ walletId: wallet.id })) {
                      await serviceAccount.renameBotWallet({
                        walletId: wallet.id,
                        name,
                      });
                    } else {
                      await serviceAccount.setWalletNameAndAvatar({
                        walletId: wallet?.id,
                        name,
                        shouldCheckDuplicate: true,
                      });
                    }
                  }
                },
              });
            }
          },
          userSelect: 'none',
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
          focusable: true,
          focusVisibleStyle: {
            outlineOffset: 2,
            outlineWidth: 2,
            outlineColor: '$focusRing',
            outlineStyle: 'solid',
          },
        })}
        {...rest}
      >
        <SizableText size={textSize} pr="$1.5" numberOfLines={1} flexShrink={1}>
          {wallet?.name}
        </SizableText>
        {canRename ? (
          <Icon
            flexShrink={0}
            name="PencilSolid"
            size="$4"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
      {wallet.type === WALLET_TYPE_HD && !wallet.backuped ? (
        <Badge ml="auto" badgeSize="sm" badgeType="critical">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.wallet_backup_status_not_backed_up,
            })}
          </Badge.Text>
        </Badge>
      ) : null}
    </>
  );
}
