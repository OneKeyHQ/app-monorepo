import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  Button,
  Icon,
  NumberSizeableText,
  Progress,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { YStackProps } from 'tamagui';

type IStakedValue = {
  value: number;
  stakedNumber: number;
  availableNumber: number;
  tokenSymbol: string;
};

type IPortfolioValue = {
  pendingInactive?: string;
  pendingInactivePeriod?: string;
  pendingActive?: string;
  pendingActiveTooltip?: string;
  claimable?: string;
  token: IToken;
  onClaim?: () => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
  babylonOverflow?: string;
};

type IProfit = {
  apr: string;
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
  minStaking?: {
    value: number;
    token: string;
  };
  untilNextLaunch?: {
    value: number;
    token: string;
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
}: IStakedValue) {
  const totalNumber = stakedNumber + availableNumber;
  const intl = useIntl();
  return (
    <YStack gap="$6" pb="$8" px="$5">
      <YStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_staked_value })}
        </SizableText>
        <NumberSizeableText
          size="$heading4xl"
          color={value === 0 ? '$textDisabled' : '$text'}
          formatter="value"
          formatterOptions={{ currency: '$' }}
        >
          {value || 0}
        </NumberSizeableText>
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
}: {
  tokenImageUri?: string;
  tokenSymbol: string;
  amount: string;
  statusText: string;
  onPress?: () => void;
  buttonText?: string;
  tooltip?: string;
}) => (
  <XStack alignItems="center" justifyContent="space-between">
    <XStack alignItems="center" gap="$1.5">
      <Token size="sm" tokenImageUri={tokenImageUri} />
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="value"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
      <XStack gap="$1" ai="center">
        <SizableText size="$bodyLg">{statusText}</SizableText>
      </XStack>
      {tooltip ? (
        <Tooltip
          placement="top"
          renderContent={tooltip}
          renderTrigger={
            <Icon color="$textSubdued" name="InfoCircleOutline" size="$5" />
          }
        />
      ) : null}
    </XStack>
    {buttonText && onPress ? (
      <XStack>
        <Button variant="primary" onPress={onPress}>
          {buttonText}
        </Button>
      </XStack>
    ) : null}
  </XStack>
);

function Portfolio({
  pendingInactive,
  pendingInactivePeriod,
  pendingActive,
  pendingActiveTooltip,
  claimable,
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
    Number(babylonOverflow) > 0
  ) {
    return (
      <YStack pt="$3" pb="$8" gap="$6" px="$5">
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
    <YStack {...props}>
      <XStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        {tooltip ? (
          <Tooltip
            placement="top"
            renderContent={tooltip}
            renderTrigger={
              <Icon color="$textSubdued" name="InfoCircleOutline" size="$5" />
            }
          />
        ) : null}
      </XStack>
      <XStack gap="$1" alignItems="center">
        <SizableText size="$bodyLgMedium">{children}</SizableText>
        {link ? (
          <Stack onPress={openLink} cursor="pointer">
            <Icon name="OpenOutline" color="$textSubdued" size="$5" />
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
  const { gtMd } = useMedia();
  const gridItemStyle = useMemo(
    () =>
      gtMd
        ? {
            flexGrow: 1,
            flexBasis: 0,
            pt: '$6',
          }
        : {
            width: '50%',
            pt: '$6',
          },
    [gtMd],
  );
  const intl = useIntl();
  return (
    <YStack py="$8" px="$5">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_profit })}
      </SizableText>
      <XStack $md={{ flexWrap: 'wrap' }}>
        <GridItem
          title={intl.formatMessage({
            id: ETranslations.earn_rewards_percentage,
          })}
          {...gridItemStyle}
        >
          <NumberSizeableText
            formatter="priceChange"
            formatterOptions={{ tokenSymbol: 'APR' }}
          >
            {apr}
          </NumberSizeableText>
        </GridItem>
        {earningsIn24h ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
            tooltip={intl.formatMessage({
              id: ETranslations.earn_24h_earnings_tooltip,
            })}
            {...gridItemStyle}
          >
            <NumberSizeableText
              formatter="priceChange"
              formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
            >
              {earningsIn24h}
            </NumberSizeableText>
          </GridItem>
        ) : null}
        {rewardTokens ? (
          <GridItem
            title={intl.formatMessage({ id: ETranslations.earn_reward_tokens })}
            {...gridItemStyle}
          >
            {rewardTokens}
          </GridItem>
        ) : null}
        {updateFrequency ? (
          <GridItem
            title={intl.formatMessage({
              id: ETranslations.earn_update_frequency,
            })}
            {...gridItemStyle}
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
  minStaking,
  untilNextLaunch,
}: IProvider) {
  const { gtMd } = useMedia();
  const gridItemStyle = useMemo(
    () =>
      gtMd
        ? {
            flexGrow: 1,
            flexBasis: 0,
            pt: '$6',
          }
        : {
            width: '50%',
            pt: '$6',
          },
    [gtMd],
  );
  const intl = useIntl();
  return (
    <YStack py="$8" px="$5">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.swap_history_detail_provider })}
      </SizableText>
      <XStack $md={{ flexWrap: 'wrap' }}>
        <GridItem
          title={
            validator.isProtocol
              ? intl.formatMessage({ id: ETranslations.global_protocol })
              : intl.formatMessage({ id: ETranslations.earn_validator })
          }
          {...gridItemStyle}
          link={validator.link}
        >
          {`${validator.name.charAt(0).toUpperCase()}${validator.name.slice(
            1,
          )}`}
        </GridItem>
        {minStaking ? (
          <GridItem
            title={intl.formatMessage({
              id: ETranslations.earn_min_max_staking,
            })}
            {...gridItemStyle}
          >
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ tokenSymbol: minStaking.token }}
            >
              {minStaking.value}
            </NumberSizeableText>
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
            {...gridItemStyle}
          >
            <SizableText>
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
      </XStack>
    </YStack>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [show, setShow] = useState(false);
  const onToggle = useCallback(() => setShow((v) => !v), []);
  return (
    <YStack>
      <XStack
        mb="$2"
        hoverStyle={{ backgroundColor: '$bgHover' }}
        pressStyle={{ backgroundColor: '$bgHover' }}
        borderRadius={12}
        onPress={onToggle}
        py="$2"
      >
        <XStack flex={1} mx="$5">
          <XStack flex={1}>
            <SizableText size="$headingMd">{question}</SizableText>
          </XStack>
          <XStack>
            <Icon
              name={show ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
            />
          </XStack>
        </XStack>
      </XStack>
      <XStack px="$5">
        {show ? (
          <SizableText size="$bodyMd" pb="$5">
            {answer}
          </SizableText>
        ) : null}
      </XStack>
    </YStack>
  );
}
function FAQ({ solutions }: { solutions: ISolutions }) {
  return (
    <YStack py="$8" gap="$6">
      <SizableText size="$headingLg" px="$5">
        FAQ
      </SizableText>
      <YStack>
        {solutions.map(({ question, answer }, index) => (
          <FAQItem question={question} answer={answer} key={String(index)} />
        ))}
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
      mt="$3"
      mx="$5"
      fullBleed
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderCautionSubdued"
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
        { number: pendingActiveTooltip },
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
      babylonOverflow: details.overflow,
      token: details.token.info,
    };
    if (details.provider.minStakeAmount) {
      provider.minStaking = {
        value: Number(details.provider.minStakeAmount),
        token: details.token.info.symbol,
      };
    }
    if (details.provider.nextLaunchLeft) {
      provider.untilNextLaunch = {
        value: Number(details.provider.nextLaunchLeft),
        token: details.token.info.symbol,
      };
    }
    const profit: IProfit = {
      apr: details.provider.apr,
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
    <YStack>
      {earnAccount?.accountAddress ? (
        <>
          <StakedValue {...stakedValue} />
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
      <Profit {...profit} />
      <Provider {...provider} />
      <FAQ solutions={solutions} />
    </YStack>
  );
}
