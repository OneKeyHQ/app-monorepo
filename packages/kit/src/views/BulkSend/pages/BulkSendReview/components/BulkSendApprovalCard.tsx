import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Accordion,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  View,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useBulkSendReviewContext } from './Context';

type IApprovalItemProps = {
  approveInfo: IApproveInfo;
  networkImageUri?: string;
  index: number;
  onEdit?: (index: number) => void;
};

function ApprovalItem({
  approveInfo,
  networkImageUri,
  index,
  onEdit,
}: IApprovalItemProps) {
  const intl = useIntl();
  const { networkId } = useBulkSendReviewContext();
  const tokenInfo = approveInfo.tokenInfo;

  const [displaySpender, setDisplaySpender] = useState(approveInfo.spender);
  useEffect(() => {
    void backgroundApiProxy.serviceValidator
      .localValidateAddress({
        networkId,
        address: approveInfo.spender,
      })
      .then((result) => {
        if (result.isValid && result.displayAddress) {
          setDisplaySpender(result.displayAddress);
        }
      });
  }, [networkId, approveInfo.spender]);

  const shortenedSpender = accountUtils.shortenAddress({
    address: displaySpender,
  });

  const isResetApproval = approveInfo.amount === '0';
  const displayAmount = isResetApproval
    ? intl.formatMessage({
        id: ETranslations.wallet_bulk_send_approval_reset_to_zero,
      })
    : approveInfo.amount;
  const { copyText } = useClipboard();

  return (
    <YStack>
      {/* Token Row */}
      <XStack gap="$3" alignItems="center" minHeight={48} px="$4" py="$2">
        <Token
          size="md"
          tokenImageUri={tokenInfo?.logoURI}
          networkImageUri={networkImageUri}
        />
        <YStack flex={1}>
          <SizableText size="$bodyLgMedium">
            {tokenInfo?.symbol ?? 'Token'}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {isResetApproval
              ? intl.formatMessage({
                  id: ETranslations.wallet_bulk_send_approval_reset,
                })
              : intl.formatMessage({
                  id: ETranslations.global_approve,
                })}
          </SizableText>
        </YStack>
        <XStack gap="$3" alignItems="center">
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol: tokenInfo?.symbol }}
          >
            {displayAmount}
          </NumberSizeableText>
          {onEdit && !isResetApproval ? (
            <IconButton
              icon="PencilOutline"
              variant="tertiary"
              size="small"
              onPress={() => onEdit(index)}
            />
          ) : null}
        </XStack>
      </XStack>

      {/* Divider */}
      <XStack px="$4" py="$1">
        <Divider />
      </XStack>

      {/* Spender Row */}
      <XStack gap="$3" alignItems="center" minHeight={48} px="$4" py="$2">
        <YStack flex={1}>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.wallet_bulk_send_approval_spender,
            })}
          </SizableText>
        </YStack>
        <XStack gap="$3" alignItems="center">
          <YStack alignItems="flex-end">
            <SizableText size="$bodyMdMedium">OneKey Bulk Send</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {shortenedSpender}
            </SizableText>
          </YStack>
          <IconButton
            icon="OpenOutline"
            variant="tertiary"
            size="small"
            onPress={() => {
              void openExplorerAddressUrl({
                networkId: tokenInfo?.networkId ?? '',
                address: displaySpender,
                openInExternal: true,
              });
            }}
          />
          <IconButton
            icon="Copy3Outline"
            variant="tertiary"
            size="small"
            onPress={() => {
              copyText(displaySpender);
            }}
          />
        </XStack>
      </XStack>
    </YStack>
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
type Props = {
  onEditApproval?: (index: number) => void;
};

function BulkSendApprovalCard({ onEditApproval }: Props) {
  const intl = useIntl();
  const { approvesInfo, networkImageUri } = useBulkSendReviewContext();

  if (approvesInfo.length === 0) {
    return null;
  }

  // Check if any approval is unlimited
  const hasUnlimitedApproval = approvesInfo.some((info) => info.isMax);

  // Calculate total approval amount (excluding reset approvals)
  // If any approval is unlimited, show "Unlimited"
  const totalApprovalAmount = hasUnlimitedApproval
    ? null
    : approvesInfo
        .filter((info) => info.amount !== '0')
        .reduce((sum, info) => sum.plus(info.amount || '0'), new BigNumber(0))
        .toFixed();

  const tokenSymbol = approvesInfo[0]?.tokenInfo?.symbol ?? 'Token';

  return (
    <YStack px="$5">
      <YStack bg="$bgSubdued" borderRadius="$3" py="$2" overflow="hidden">
        <Accordion type="single" collapsible defaultValue="" bg="transparent">
          <Accordion.Item value="approval" bg="transparent">
            <Accordion.Trigger
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              px="$4"
              py="$1"
              unstyled
              focusStyle={{}}
              pressStyle={{}}
              borderWidth={0}
              outlineWidth={0}
              backgroundColor="transparent"
            >
              {({ open }: { open: boolean }) => (
                <>
                  <SizableText size="$headingSm">
                    {intl.formatMessage({
                      id: ETranslations.global_approval,
                    })}
                  </SizableText>
                  <XStack
                    flex={1}
                    gap="$2"
                    alignItems="center"
                    justifyContent="flex-end"
                  >
                    {!open ? (
                      <>
                        <Token
                          size="xs"
                          tokenImageUri={approvesInfo[0]?.tokenInfo?.logoURI}
                        />
                        {hasUnlimitedApproval ? (
                          <SizableText size="$bodyMdMedium">
                            {intl.formatMessage({
                              id: ETranslations.approve_edit_unlimited_amount,
                            })}
                          </SizableText>
                        ) : (
                          <NumberSizeableText
                            size="$bodyMdMedium"
                            formatter="balance"
                            formatterOptions={{ tokenSymbol }}
                          >
                            {totalApprovalAmount ?? '0'}
                          </NumberSizeableText>
                        )}
                      </>
                    ) : null}
                    <View
                      animation="quick"
                      rotate={open ? '180deg' : '0deg'}
                      transformOrigin="center"
                    >
                      <Icon
                        name="ChevronDownSmallOutline"
                        size="$5"
                        color="$iconSubdued"
                      />
                    </View>
                  </XStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator
              animation="quick"
              backgroundColor="transparent"
            >
              <Accordion.Content
                animation="quick"
                exitStyle={{ opacity: 0 }}
                backgroundColor="transparent"
                padding="$0"
              >
                {approvesInfo.map((approveInfo, index) => (
                  <ApprovalItem
                    key={`${approveInfo.spender}-${approveInfo.amount}-${index}`}
                    approveInfo={approveInfo}
                    networkImageUri={networkImageUri}
                    index={index}
                    onEdit={onEditApproval}
                  />
                ))}
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      </YStack>
    </YStack>
  );
}

export default BulkSendApprovalCard;
