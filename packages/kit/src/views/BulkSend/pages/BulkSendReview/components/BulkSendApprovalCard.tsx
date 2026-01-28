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
} from '@onekeyhq/components';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { Token } from '@onekeyhq/kit/src/components/Token';

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
  const tokenInfo = approveInfo.tokenInfo;
  const shortenedSpender = accountUtils.shortenAddress({
    address: approveInfo.spender,
  });

  const isResetApproval = approveInfo.amount === '0';
  const displayAmount = isResetApproval ? 'Reset to 0' : approveInfo.amount;

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
            {isResetApproval ? 'Reset Approval' : 'Approve'}
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
            Spender
          </SizableText>
        </YStack>
        <XStack gap="$3" alignItems="center">
          <YStack alignItems="flex-end">
            <SizableText size="$bodyMdMedium">OneKey</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {shortenedSpender}
            </SizableText>
          </YStack>
          <IconButton
            icon="OpenOutline"
            variant="tertiary"
            size="small"
            onPress={() => {
              // TODO: Open explorer
            }}
          />
          <IconButton
            icon="Copy3Outline"
            variant="tertiary"
            size="small"
            onPress={() => {
              // TODO: Copy address
            }}
          />
        </XStack>
      </XStack>
    </YStack>
  );
}

type Props = {
  approvesInfo: IApproveInfo[];
  networkImageUri?: string;
  onEditApproval?: (index: number) => void;
};

function BulkSendApprovalCard({
  approvesInfo,
  networkImageUri,
  onEditApproval,
}: Props) {
  if (approvesInfo.length === 0) {
    return null;
  }

  // Calculate total approval amount (excluding reset approvals)
  const totalApprovalAmount = approvesInfo
    .filter((info) => info.amount !== '0')
    .reduce((sum, info) => sum + Number(info.amount), 0);

  const tokenSymbol = approvesInfo[0]?.tokenInfo?.symbol ?? 'Token';

  return (
    <YStack px="$5" py="$3">
      <YStack bg="$bgSubdued" borderRadius="$3" py="$2" overflow="hidden">
        <Accordion type="single" collapsible defaultValue="">
          <Accordion.Item value="approval">
            <Accordion.Trigger
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              px="$4"
              py="$1"
              unstyled
            >
              {({ open }: { open: boolean }) => (
                <>
                  <SizableText flex={1} size="$headingSm">
                    Token approval
                  </SizableText>
                  <XStack gap="$2" alignItems="center">
                    {!open ? (
                      <>
                        <Token
                          size="xs"
                          tokenImageUri={approvesInfo[0]?.tokenInfo?.logoURI}
                        />
                        <NumberSizeableText
                          size="$bodyMdMedium"
                          formatter="balance"
                          formatterOptions={{ tokenSymbol }}
                        >
                          {String(totalApprovalAmount)}
                        </NumberSizeableText>
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
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content animation="quick" exitStyle={{ opacity: 0 }}>
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
