import { memo, useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconButtonProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Icon,
  IconButton,
  Image,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showClaimWithKycDialog } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/showKYCDialog';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes/staking';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IEarnActionIcon,
  IEarnClaimActionIcon,
  IEarnClaimWithKycActionIcon,
  IEarnIcon,
  IEarnPopupActionIcon,
  IEarnPortfolioActionIcon,
  IEarnText,
  IEarnToken,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { useHandleClaim } from '../../pages/ProtocolDetails/useHandleClaim';

import { EarnIcon } from './EarnIcon';
import { EarnText } from './EarnText';

// Hook to handle claim action press
function useHandleClaimAction({
  protocolInfo,
  tokenInfo,
  token,
}: {
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  token?: IEarnToken;
}) {
  const handleClaim = useHandleClaim({
    accountId: protocolInfo?.earnAccount?.accountId || '',
    networkId: tokenInfo?.networkId || '',
  });

  return useCallback(
    async ({
      actionIcon,
      setLoading,
    }: {
      actionIcon: IEarnClaimActionIcon;
      setLoading: (loading: boolean) => void;
    }) => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 10 * 1000);
      const claimAmount =
        protocolInfo?.claimable || actionIcon.data?.balance || '0';
      const isMorphoClaim = !!(
        tokenInfo?.provider &&
        earnUtils.isMorphoProvider({
          providerName: tokenInfo?.provider,
        })
      );
      await handleClaim({
        claimType: actionIcon.type,
        symbol: protocolInfo?.symbol || '',
        protocolInfo,
        tokenInfo: tokenInfo
          ? {
              ...tokenInfo,
              token: token as IEarnToken,
            }
          : undefined,
        claimAmount,
        claimTokenAddress: token?.address,
        isMorphoClaim,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({
            providerName: tokenInfo?.provider || '',
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          receive: {
            token: token as IEarnToken,
            amount: claimAmount,
          },
          tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
        },
      });
      setLoading(false);
    },
    [handleClaim, protocolInfo, tokenInfo, token],
  );
}

function PopupItemLine({
  icon,
  title,
  value,
  token,
}: {
  icon?: IEarnIcon;
  token?: IEarnToken;
  title: IEarnText;
  value: string;
}) {
  return (
    <XStack gap="$2" alignItems="center" justifyContent="space-between">
      <XStack gap="$2" alignItems="center">
        <EarnIcon icon={icon} size="$4" color="$iconSubdued" />
        {token?.logoURI ? (
          <Image src={token.logoURI ?? ''} w="$4" h="$4" />
        ) : null}
        <SizableText color={title.color} size={title?.size || '$bodyMd'}>
          {title.text}
        </SizableText>
      </XStack>
      <SizableText size="$bodyMdMedium">{value}</SizableText>
    </XStack>
  );
}

export function ActionPopupContent({
  bulletList,
  items,
  panel,
  description,
}: {
  bulletList: IEarnPopupActionIcon['data']['bulletList'];
  items: IEarnPopupActionIcon['data']['items'];
  panel: IEarnPopupActionIcon['data']['panel'];
  description: IEarnPopupActionIcon['data']['description'];
}) {
  return (
    <YStack p="$5">
      {items?.length ? (
        <YStack gap="$2.5">
          {items.map(({ icon, title, value, token }) => (
            <PopupItemLine
              key={title.text}
              icon={icon}
              token={token?.info}
              title={title}
              value={value}
            />
          ))}
        </YStack>
      ) : null}
      {bulletList?.length ? (
        <YStack pt="$2" gap="$2">
          {bulletList.map((text, index) => (
            <XStack key={index} gap="$1" ai="flex-start">
              <XStack
                h="$1"
                w="$1"
                my="$1.5"
                mx="$2"
                borderRadius="$full"
                bg="$iconSubdued"
                flexShrink={0}
              />
              <SizableText
                size={text.size || '$bodySm'}
                color={text.color || '$textSubdued'}
                flex={1}
                flexWrap="wrap"
              >
                {text.text}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}
      {panel?.length ? (
        <XStack
          mt="$4"
          py="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$2"
          justifyContent="space-between"
          width="100%"
        >
          {panel.map((item, index) => (
            <YStack
              key={index}
              flex={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <SizableText
                color={item.title.color || '$textSubdued'}
                size="$bodySm"
              >
                {item.title.text}
              </SizableText>
              <SizableText
                color={item.description?.color || '$text'}
                size="$bodyMdMedium"
              >
                {item.description?.text || '-'}
              </SizableText>
            </YStack>
          ))}
        </XStack>
      ) : null}
      {description?.length ? (
        <>
          <Divider my="$4" />
          {description.map((text) => (
            <EarnText
              key={text.text}
              text={text}
              size="$bodySm"
              color={text.color || '$textSubdued'}
            />
          ))}
        </>
      ) : null}
    </YStack>
  );
}

function BasicPortfolioActionIcon({
  actionIcon,
  protocolInfo,
  tokenInfo,
}: {
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  actionIcon: IEarnPortfolioActionIcon;
}) {
  const appNavigation = useAppNavigation();

  const onPortfolioDetails = useCallback(() => {
    appNavigation.push(EModalStakingRoutes.PortfolioDetails, {
      accountId: protocolInfo?.earnAccount?.accountId || '',
      networkId: tokenInfo?.networkId || '',
      symbol: protocolInfo?.symbol || '',
      provider: protocolInfo?.provider || '',
    });
  }, [
    appNavigation,
    protocolInfo?.earnAccount?.accountId,
    protocolInfo?.provider,
    protocolInfo?.symbol,
    tokenInfo?.networkId,
  ]);
  return (
    <Button
      disabled={actionIcon.disabled}
      variant="tertiary"
      iconAfter="ChevronRightOutline"
      onPress={onPortfolioDetails}
    >
      {actionIcon.text.text}
    </Button>
  );
}

const PortfolioActionIcon = memo(BasicPortfolioActionIcon);

function BasicClaimActionIcon({
  actionIcon,
  protocolInfo,
  tokenInfo,
  token,
}: {
  actionIcon: IEarnClaimActionIcon;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  token?: IEarnToken;
}) {
  const [loading, setLoading] = useState(false);
  const handleClaimAction = useHandleClaimAction({
    protocolInfo,
    tokenInfo,
    token,
  });

  return (
    <Button
      size="small"
      variant="primary"
      loading={loading}
      disabled={loading || actionIcon?.disabled}
      onPress={() => handleClaimAction({ actionIcon, setLoading })}
    >
      {typeof actionIcon.text === 'string'
        ? actionIcon.text
        : actionIcon.text.text}
    </Button>
  );
}

const ClaimActionIcon = memo(BasicClaimActionIcon);

function BasicClaimWithKycActionIcon({
  actionIcon,
  protocolInfo,
  tokenInfo,
}: {
  actionIcon: IEarnClaimWithKycActionIcon;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}) {
  const [loading, setLoading] = useState(false);
  const handleClaimAction = useHandleClaimAction({
    protocolInfo,
    tokenInfo,
    token: actionIcon.data?.token,
  });

  const handlePress = useCallback(async () => {
    if (!tokenInfo || !protocolInfo) {
      // If we don't have the necessary info, show dialog with current data
      showClaimWithKycDialog({
        actionData: actionIcon,
      });
      return;
    }

    setLoading(true);
    try {
      // Get fresh data from API
      const response =
        await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
          accountId: protocolInfo.earnAccount?.accountId || '',
          networkId: tokenInfo?.networkId || '',
          indexedAccountId: tokenInfo?.indexedAccountId,
          symbol: protocolInfo.symbol || '',
          provider: protocolInfo.provider,
          vault: protocolInfo.vault,
        });

      // Find the updated action in portfolios
      // Search in portfolios.items[].buttons
      const buttons =
        response?.portfolios?.items
          ?.flatMap((item) => item.buttons || [])
          .filter((button) => 'type' in button) || [];

      const latestClaimWithKycAction = buttons.find(
        (button) => button.type === 'claimWithKyc',
      ) as IEarnClaimWithKycActionIcon | undefined;

      const latestClaimAction = !latestClaimWithKycAction
        ? (buttons.find((button) => button.type === 'claim') as
            | IEarnClaimActionIcon
            | undefined)
        : undefined;

      // Priority: claimWithKyc > claim > no response
      if (latestClaimWithKycAction) {
        // Use the latest claimWithKyc data
        showClaimWithKycDialog({
          actionData: latestClaimWithKycAction,
        });
      } else if (latestClaimAction) {
        // Use the extracted claim action hook for fallback behavior
        await handleClaimAction({
          actionIcon: latestClaimAction,
          setLoading,
        });
      } else {
        // No valid action found, use current data
        console.warn('No claimWithKyc or claim action found in updated data');
        showClaimWithKycDialog({
          actionData: actionIcon,
        });
      }
    } catch (error) {
      // If API call fails, show dialog with current data
      console.error('Failed to fetch latest claimWithKyc data:', error);
      showClaimWithKycDialog({
        actionData: actionIcon,
      });
    } finally {
      setLoading(false);
    }
  }, [actionIcon, protocolInfo, tokenInfo, handleClaimAction]);

  return (
    <Button
      size="small"
      variant="primary"
      loading={loading}
      disabled={loading || actionIcon?.disabled}
      onPress={handlePress}
    >
      {typeof actionIcon.text === 'string'
        ? actionIcon.text
        : actionIcon.text.text}
    </Button>
  );
}

const ClaimWithKycActionIcon = memo(BasicClaimWithKycActionIcon);

function BasicEarnActionIcon({
  title,
  actionIcon,
  protocolInfo,
  tokenInfo,
  token,
  onHistory,
}: {
  title?: string;
  actionIcon?: IEarnActionIcon;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  token?: IEarnToken;
  onHistory?: (params?: { filterType?: string }) => void;
}) {
  if (!actionIcon) {
    return null;
  }
  let onPress: undefined | IIconButtonProps['onPress'];
  let icon: IKeyOfIcons | undefined;
  switch (actionIcon?.type) {
    case 'link':
      icon = 'OpenOutline';
      onPress = () => openUrlExternal(actionIcon.data.link);
      break;
    case 'portfolio':
      return (
        <PortfolioActionIcon
          actionIcon={actionIcon}
          protocolInfo={protocolInfo}
          tokenInfo={tokenInfo}
        />
      );
    case 'claim':
      return (
        <ClaimActionIcon
          protocolInfo={protocolInfo}
          tokenInfo={tokenInfo}
          token={token}
          actionIcon={actionIcon}
        />
      );
    case 'claimWithKyc':
      return (
        <ClaimWithKycActionIcon
          actionIcon={actionIcon}
          protocolInfo={protocolInfo}
          tokenInfo={tokenInfo}
        />
      );
    case 'popup':
      return actionIcon.data.icon ? (
        <Popover
          floatingPanelProps={{
            w: 360,
          }}
          title={title || ''}
          renderTrigger={
            <IconButton
              icon={actionIcon.data.icon.icon}
              size="small"
              variant="tertiary"
            />
          }
          renderContent={
            <ActionPopupContent
              bulletList={actionIcon.data.bulletList}
              items={actionIcon.data.items}
              panel={actionIcon.data.panel}
              description={actionIcon.data.description}
            />
          }
          placement="top"
        />
      ) : null;
    case 'history':
      return (
        <XStack
          gap="$0.5"
          cursor="pointer"
          onPress={() => onHistory?.({ filterType: 'rebate' })}
        >
          <EarnText
            text={actionIcon?.text}
            size="$bodyMd"
            color="$textSubdued"
          />
          <Icon
            name="ChevronRightSmallOutline"
            color="$iconSubdued"
            size="$5"
          />
        </XStack>
      );
    default:
  }
  return icon ? (
    <IconButton
      size="small"
      icon={icon}
      onPress={onPress}
      color="$iconSubdued"
      variant="tertiary"
    />
  ) : null;
}

export const EarnActionIcon = memo(BasicEarnActionIcon);
