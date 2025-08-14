import { type ComponentProps, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showLabelSetDialog as showHardwareLabelSetDialog } from './HardwareLabelSetDialog';

export function WalletRenameButton({
  wallet,
  editable,
  ...rest
}: ComponentProps<typeof XStack> & {
  wallet: IDBWallet;
  editable: boolean | undefined;
}) {
  const { serviceAccount } = backgroundApiProxy;
  const intl = useIntl();

  const canRename = useMemo(() => {
    if (accountUtils.isOthersWallet({ walletId: wallet?.id || '' })) {
      return false;
    }
    return !!editable;
  }, [editable, wallet?.id]);

  return (
    <>
      <XStack
        py="$1"
        px="$1.5"
        flexShrink={1}
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
              })
            ) {
              void showHardwareLabelSetDialog(
                {
                  wallet,
                },
                {
                  onSubmit: async (name) => {
                    await backgroundApiProxy.serviceHardware.setDeviceLabel({
                      walletId: wallet?.id || '',
                      label: name,
                    });
                  },
                },
              );
            } else {
              showRenameDialog(wallet.name, {
                nameHistoryInfo: {
                  entityId: wallet.id,
                  entityType: EChangeHistoryEntityType.Wallet,
                  contentType: EChangeHistoryContentType.Name,
                },
                disabledMaxLengthLabel: true,
                onSubmit: async (name) => {
                  if (wallet?.id && name) {
                    await serviceAccount.setWalletNameAndAvatar({
                      walletId: wallet?.id,
                      name,
                      shouldCheckDuplicate: true,
                    });
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
        <SizableText size="$bodyLgMedium" pr="$1.5" numberOfLines={1}>
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
