import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Alert,
  Button,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { capitalizeString } from '../../utils/utils';

import type { YStackProps } from 'tamagui';

type IStakedValue = {
  value: number;
  stakedNumber: number;
  availableNumber: number;
  tokenSymbol: string;
  stakeButtonProps?: ComponentProps<typeof Button>;
  withdrawButtonProps?: ComponentProps<typeof Button>;
};

type IPortfolioValue = {
  active?: string;
  pendingInactive?: string;
  pendingInactivePeriod?: string;
  pendingActive?: string;
  pendingActiveTooltip?: string;
  claimable?: string;
  minClaimableNum?: string;
  token: IToken;
  onClaim?: () => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
  babylonOverflow?: string;
};

type IProfit = {
  apr?: string;
  earningsIn24h?: string;
  rewardTokens?: string;
  updateFrequency?: string;
};

type IProvider = {
  validator: {
    isProtocol?: boolean;
    name: string;
    link: string;
  };
  minOrMaxStaking?: {
    minValue?: number;
    maxValue?: number;
    token: string;
  };
  untilNextLaunch?: {
    value: number;
    token: string;
  };
  network?: {
    name: string;
  };
};

type ISolutions = {
  question: string;
  answer: string;
}[];

type IEarnTokenDetailResult = {
  stakedValue: IStakedValue;
  portfolio: IPortfolioValue;
  profit: IProfit;
  provider: IProvider;
};

function StakedValue({
  value = 0,
  stakedNumber = 0,
  availableNumber = 0,
  tokenSymbol,
  stakeButtonProps,
  withdrawButtonProps,
}: IStakedValue) {
  const totalNumber = stakedNumber + availableNumber;
  const intl = useIntl();
  const media = useMedia();
  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_staked_value })}
        </SizableText>
        <XStack gap="$2">
          <NumberSizeableText
            flex={1}
            size="$heading4xl"
            color={value === 0 ? '$textDisabled' : '$text'}
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {value || 0}
          </NumberSizeableText>
          {media.gtMd ? (
            <XStack gap="$2">
              <Button {...withdrawButtonProps}>
                {intl.formatMessage({ id: ETranslations.global_withdraw })}
              </Button>
              <Button {...stakeButtonProps}>
                {intl.formatMessage({ id: ETranslations.earn_stake })}
              </Button>
            </XStack>
          ) : null}
        </XStack>
      </YStack>
      <YStack gap="$1.5">
        <YStack my="$1.5">
          <Progress
            colors={['$bgSuccessStrong', '$bgInverse']}
            size="medium"
            gap={2}
            value={totalNumber === 0 ? 0 : (stakedNumber / totalNumber) * 100}
          />
        </YStack>
        <XStack justifyContent="space-between">
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.earn_staked })}
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ tokenSymbol }}
            >
              {stakedNumber || 0}
            </NumberSizeableText>
          </YStack>
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSuccess" textAlign="right">
              {intl.formatMessage({ id: ETranslations.global_available })}
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ tokenSymbol }}
            >
              {availableNumber || 0}
            </NumberSizeableText>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

const PortfolioItem = ({
  tokenImageUri,
  tokenSymbol,
  amount,
  statusText,
  onPress,
  buttonText,
  tooltip,
  disabled,
}: {
  tokenImageUri?: string;
  tokenSymbol: string;
  amount: string;
  statusText: string;
  onPress?: () => void;
  buttonText?: string;
  tooltip?: string;
  disabled?: boolean;
}) => (
  <XStack alignItems="center" justifyContent="space-between">
    <XStack alignItems="center" gap="$1.5">
      <Token size="sm" tokenImageUri={tokenImageUri} />
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
      <XStack gap="$1" ai="center">
        <SizableText size="$bodyLg">{statusText}</SizableText>
      </XStack>
      {tooltip ? (
        <Popover
          placement="bottom"
          title={statusText}
          renderTrigger={
            <IconButton
              iconColor="$iconSubdued"
              size="small"
              icon="InfoCircleOutline"
              variant="tertiary"
            />
          }
          renderContent={
            <Stack p="$5">
              <SizableText>{tooltip}</SizableText>
            </Stack>
          }
        />
      ) : null}
    </XStack>
    {buttonText && onPress ? (
      <XStack>
        <Button
          size="small"
          disabled={disabled}
          variant="primary"
          onPress={onPress}
        >
          {buttonText}
        </Button>
      </XStack>
    ) : null}
  </XStack>
);

function Portfolio({
  active,
  pendingInactive,
  pendingInactivePeriod,
  pendingActive,
  pendingActiveTooltip,
  claimable,
  minClaimableNum,
  token,
  babylonOverflow,
  onClaim,
  onWithdraw,
  onPortfolioDetails,
}: IPortfolioValue) {
  const intl = useIntl();
  if (
    Number(pendingInactive) > 0 ||
    Number(claimable) > 0 ||
    Number(pendingActive) > 0 ||
    Number(babylonOverflow) > 0 ||
    Number(active) > 0
  ) {
    const isLessThanMinClaimable = Boolean(
      minClaimableNum &&
        claimable &&
        Number(claimable) < Number(minClaimableNum),
    );
    return (
      <YStack gap="$6">
        <XStack justifyContent="space-between">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.earn_portfolio })}
          </SizableText>
          {onPortfolioDetails !== undefined ? (
            <Button
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              onPress={onPortfolioDetails}
            >
              {intl.formatMessage({ id: ETranslations.global_details })}
            </Button>
          ) : null}
        </XStack>
        <YStack gap="$3">
          {active && Number(active) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={active}
              statusText={intl.formatMessage({
                id: ETranslations.earn_active,
              })}
            />
          ) : null}
          {pendingInactive && Number(pendingInactive) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={pendingInactive}
              statusText={intl.formatMessage({
                id: ETranslations.earn_withdrawal_requested,
              })}
              tooltip={
                pendingInactivePeriod
                  ? intl.formatMessage(
                      {
                        id: ETranslations.earn_withdrawal_up_to_number_days,
                      },
                      { number: pendingInactivePeriod },
                    )
                  : undefined
              }
            />
          ) : null}
          {pendingActive && Number(pendingActive) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={pendingActive}
              tooltip={pendingActiveTooltip}
              statusText={intl.formatMessage({
                id: ETranslations.earn_pending_activation,
              })}
            />
          ) : null}
          {claimable && Number(claimable) > 0 ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={claimable}
              statusText={intl.formatMessage({
                id: ETranslations.earn_claimable,
              })}
              onPress={onClaim}
              buttonText={intl.formatMessage({
                id: ETranslations.earn_claim,
              })}
              tooltip={
                isLessThanMinClaimable
                  ? intl.formatMessage(
                      {
                        id: ETranslations.earn_minimum_claim_tooltip,
                      },
                      { number: minClaimableNum, symbol: token.symbol },
                    )
                  : undefined
              }
              disabled={isLessThanMinClaimable}
            />
          ) : null}
        </YStack>
        {Number(babylonOverflow) > 0 ? (
          <Alert
            mt="$3"
            fullBleed
            borderRadius="$3"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderCautionSubdued"
            type="critical"
            title={intl.formatMessage(
              {
                id: ETranslations.earn_overflow_number_alert,
              },
              { number: babylonOverflow },
            )}
            action={{
              primary: intl.formatMessage({
                id: ETranslations.global_withdraw,
              }),
              onPrimaryPress: onWithdraw,
            }}
          />
        ) : null}
      </YStack>
    );
  }
  return null;
}

function GridItem({
  title,
  children,
  tooltip,
  link,
  ...props
}: PropsWithChildren<
  { title: string; tooltip?: string; link?: string } & YStackProps
>) {
  const openLink = useCallback(() => {
    if (link) {
      openUrlExternal(link);
    }
  }, [link]);
  return (
    <YStack
      p="$3"
      flexBasis="50%"
      $gtMd={{
        flexBasis: '33.33%',
      }}
      {...props}
    >
      <XStack gap="$1" mb="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        {tooltip ? (
          <Popover
            placement="top"
            title={title}
            renderTrigger={
              <IconButton
                iconColor="$iconSubdued"
                size="small"
                icon="InfoCircleOutline"
                variant="tertiary"
              />
            }
            renderContent={
              <Stack p="$5">
                <SizableText>{tooltip}</SizableText>
              </Stack>
            }
          />
        ) : null}
      </XStack>
      <XStack gap="$1" alignItems="center">
        <SizableText size="$bodyLgMedium">{children}</SizableText>
        {link ? (
          <Stack onPress={openLink} cursor="pointer">
            <Icon name="OpenOutline" color="$iconSubdued" size="$5" />
          </Stack>
        ) : null}
      </XStack>
    </YStack>
  );
}

export function Profit({
  apr,
  earningsIn24h,
  rewardTokens,
  updateFrequency,
}: IProfit) {
  const intl = useIntl();

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_profit })}
      </SizableText>
      <XStack flexWrap="wrap" m="$-5" p="$2">
        {apr && Number(apr) > 0 ? (
          <GridItem
            title={intl.formatMessage({
              id: ETranslations.earn_rewards_percentage,
            })}
          >
            <SizableText size="$bodyLgMedium" color="$textSuccess">
              {`${apr}% ${intl.formatMessage({
                id: ETranslations.global_apr,
              })}`}
            </SizableText>
          </GridItem>
        ) : null}
        {earningsIn24h && Number(earningsIn24h) > 0 ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
            tooltip={intl.formatMessage({
              id: ETranslations.earn_24h_earnings_tooltip,
            })}
          >
            <NumberSizeableText
              formatter="value"
              color="$textSuccess"
              size="$bodyLgMedium"
              formatterOptions={{ currency: symbol }}
            >
              {earningsIn24h}
            </NumberSizeableText>
          </GridItem>
        ) : null}
        {rewardTokens ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_reward_tokens })}
          >
            {rewardTokens}
          </GridItem>
        ) : null}
        {updateFrequency ? (
          <GridItem
            title={intl.formatMessage({
              id: ETranslations.earn_update_frequency,
            })}
          >
            {updateFrequency}
          </GridItem>
        ) : null}
      </XStack>
    </YStack>
  );
}

export function Provider({
  validator,
  minOrMaxStaking,
  untilNextLaunch,
  network,
}: IProvider) {
  const intl = useIntl();
  let minOrMaxStakingItem: { label: string; value: string } | undefined;
  if (minOrMaxStaking) {
    const { minValue, maxValue } = minOrMaxStaking;
    if (maxValue && minValue) {
      minOrMaxStakingItem = {
        label: intl.formatMessage({
          id: ETranslations.earn_min_max_staking,
        }),
        value: `${minValue}/${maxValue} ${minOrMaxStaking.token}`,
      };
    } else if (minValue) {
      minOrMaxStakingItem = {
        label: intl.formatMessage({
          id: ETranslations.earn_min_staking,
        }),
        value: `${minValue} ${minOrMaxStaking.token}`,
      };
    }
  }

  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.swap_history_detail_provider })}
      </SizableText>
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={
            validator.isProtocol
              ? intl.formatMessage({ id: ETranslations.global_protocol })
              : intl.formatMessage({ id: ETranslations.earn_validator })
          }
          link={validator.link}
        >
          {capitalizeString(validator.name)}
        </GridItem>
        {minOrMaxStakingItem ? (
          <GridItem title={minOrMaxStakingItem.label}>
            <SizableText size="$bodyLgMedium">
              {minOrMaxStakingItem.value}
            </SizableText>
          </GridItem>
        ) : null}
        {untilNextLaunch ? (
          <GridItem
            title={intl.formatMessage({
              id: ETranslations.earn_until_next_launch,
            })}
            tooltip={intl.formatMessage({
              id: ETranslations.earn_until_next_launch_tooltip,
            })}
          >
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage(
                { id: ETranslations.earn_number_symbol_left },
                {
                  number: Number(untilNextLaunch.value).toFixed(2),
                  symbol: untilNextLaunch.token,
                },
              )}
            </SizableText>
          </GridItem>
        ) : null}
        {network?.name ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.global_network })}
          >
            {network.name}
          </GridItem>
        ) : null}
      </XStack>
    </YStack>
  );
}

function FAQ({ solutions }: { solutions: ISolutions }) {
  const intl = useIntl();
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {solutions.map(({ question, answer }, index) => (
            <Accordion.Item value={String(index)} key={String(index)}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                my="$-1"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$bodyLgMedium"
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {question}
                    </SizableText>
                    <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconActive' : '$iconSubdued'}
                        size="$5"
                      />
                    </Stack>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pt="$2"
                  pb="$5"
                  animation="quick"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  <SizableText size="$bodyMd">{answer}</SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}

function NoAddressWarning({
  accountId,
  networkId,
  indexedAccountId,
  onCreateAddress,
}: {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  onCreateAddress: () => void;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { createAddress } = useAccountSelectorCreateAddress();
  const handleCreateAddress = useCallback(async () => {
    setIsLoading(true);
    try {
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      await createAddress({
        num: 0,
        account: {
          walletId: wallet?.id,
          networkId,
          indexedAccountId,
          deriveType: networkUtils.isBTCNetwork(networkId)
            ? 'BIP86'
            : deriveType,
        },
        selectAfterCreate: false,
      });
      onCreateAddress();
    } finally {
      setIsLoading(false);
    }
  }, [wallet, indexedAccountId, networkId, createAddress, onCreateAddress]);

  const { result } = usePromiseResult(async () => {
    const { serviceAccount, serviceNetwork } = backgroundApiProxy;
    let accountName = '';
    try {
      const account = await serviceAccount.getAccount({
        accountId,
        networkId,
      });
      accountName = account.name;
    } catch (e) {
      if (indexedAccountId) {
        const indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId,
        });
        accountName = indexedAccount.name;
      }
    }

    const network = await serviceNetwork.getNetwork({ networkId });
    return {
      accountName,
      networkName: network.name,
    };
  }, [accountId, indexedAccountId, networkId]);

  const isOthersAccount = accountUtils.isOthersAccount({ accountId });

  const content = useMemo(() => {
    if (isOthersAccount) {
      return {
        title: intl.formatMessage(
          { id: ETranslations.wallet_unsupported_network_title },
          { network: result?.networkName ?? '' },
        ),
        description: intl.formatMessage({
          id: ETranslations.wallet_unsupported_network_desc,
        }),
      };
    }

    return {
      title: intl.formatMessage({
        id: ETranslations.wallet_no_address,
      }),
      description: intl.formatMessage(
        {
          id: ETranslations.global_private_key_error,
        },
        {
          network: result?.networkName ?? '',
          path: networkUtils.isBTCNetwork(networkId) ? '(Taproot)' : '',
        },
      ),
    };
  }, [result, isOthersAccount, networkId, intl]);

  if (!result) {
    return null;
  }

  return (
    <Alert
      type="warning"
      title={content.title}
      description={content.description}
      action={
        isOthersAccount
          ? undefined
          : {
              primary: intl.formatMessage({
                id: ETranslations.dapp_connect_create,
              }),
              onPrimaryPress: () => handleCreateAddress(),
              isPrimaryLoading: isLoading,
            }
      }
    />
  );
}

type IProtocolDetails = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  earnAccount?:
    | {
        accountId: string;
        networkId: string;
        accountAddress: string;
        account: INetworkAccount;
      }
    | null
    | undefined;
  details?: IStakeProtocolDetails;
  onClaim?: () => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
  onCreateAddress: () => void;
  stakeButtonProps?: ComponentProps<typeof Button>;
  withdrawButtonProps?: ComponentProps<typeof Button>;
};

export function ProtocolDetails({
  accountId,
  networkId,
  indexedAccountId,
  earnAccount,
  details,
  onClaim,
  onWithdraw,
  onPortfolioDetails,
  onCreateAddress,
  stakeButtonProps,
  withdrawButtonProps,
}: IProtocolDetails) {
  const intl = useIntl();
  const result: IEarnTokenDetailResult | null = useMemo(() => {
    if (!details) {
      return null;
    }
    const provider: IProvider = {
      validator: {
        name: details.provider.name,
        link: details.provider.website,
        isProtocol: details.provider.name.toLowerCase() !== 'everstake',
      },
    };
    let pendingActiveTooltip: string | undefined;
    if (
      details.provider.name.toLowerCase() === 'everstake' &&
      details.token.info.name.toLowerCase() === 'eth'
    ) {
      pendingActiveTooltip = intl.formatMessage({
        id: ETranslations.earn_pending_activation_tooltip_eth,
      });
    } else if (details.pendingActivatePeriod) {
      pendingActiveTooltip = intl.formatMessage(
        {
          id: ETranslations.earn_pending_activation_tooltip,
        },
        { number: details.pendingActivatePeriod },
      );
    }
    const portfolio: IPortfolioValue = {
      pendingInactive: details.pendingInactive,
      pendingInactivePeriod: details.unstakingPeriod
        ? String(details.unstakingPeriod)
        : undefined,
      pendingActive: details.pendingActive,
      pendingActiveTooltip,
      claimable: details.claimable,
      active: details.active,
      minClaimableNum: details.provider.minClaimableAmount,
      babylonOverflow:
        Number(details?.staked) - Number(details?.pendingInactive) &&
        Number(details.overflow) > 0
          ? details.overflow
          : undefined,
      token: details.token.info,
    };
    if (details.provider.minStakeAmount) {
      provider.minOrMaxStaking = {
        minValue: Number(details.provider.minStakeAmount),
        maxValue: Number(details.provider.maxStakeAmount),
        token: details.token.info.symbol,
      };
    }
    if (details.provider.nextLaunchLeft) {
      provider.untilNextLaunch = {
        value: Number(details.provider.nextLaunchLeft),
        token: details.token.info.symbol,
      };
    }
    if (details.network) {
      provider.network = details.network;
    }
    const profit: IProfit = {
      apr: Number(details.provider?.apr) > 0 ? details.provider.apr : undefined,
      earningsIn24h: details.earnings24h,
      rewardTokens: details.rewardToken,
      updateFrequency: details.updateFrequency,
    };
    const data: IEarnTokenDetailResult = {
      stakedValue: {
        value: Number(details.stakedFiatValue),
        stakedNumber: Number(details.staked),
        availableNumber: Number(details.available),
        tokenSymbol: details.token.info.symbol,
      },
      portfolio,
      profit,
      provider,
    };
    return data;
  }, [details, intl]);

  const { result: solutions } = usePromiseResult(
    async () =>
      details
        ? backgroundApiProxy.serviceStaking.getFAQList({
            symbol: details.token.info.symbol,
            provider: details.provider.name,
          })
        : Promise.resolve([]),
    [details],
    {
      initResult: [],
    },
  );

  if (!result) {
    return null;
  }

  const { stakedValue, portfolio, profit, provider } = result;
  return (
    <>
      {earnAccount?.accountAddress ? (
        <>
          <StakedValue
            {...stakedValue}
            stakeButtonProps={stakeButtonProps}
            withdrawButtonProps={withdrawButtonProps}
          />
          <Portfolio
            {...portfolio}
            onClaim={onClaim}
            onWithdraw={onWithdraw}
            onPortfolioDetails={onPortfolioDetails}
          />
        </>
      ) : (
        <NoAddressWarning
          accountId={accountId}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          onCreateAddress={onCreateAddress}
        />
      )}
      <Divider />
      <Profit {...profit} />
      <Divider />
      <Provider {...provider} />
      <Divider />
      <FAQ solutions={solutions} />
    </>
  );
}
