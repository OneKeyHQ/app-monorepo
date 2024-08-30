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
  pendingActive?: string;
  claimable?: string;
  token: IToken;
  onClaim?: () => void;
  onPortfolioDetails?: () => void;
};

type IProfit = {
  apr: string;
  earningsIn24h?: string;
  rewardTokens?: string;
  updateFrequency?: string;
};

type IProvider = {
  validator: {
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
    tooltip: string;
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
  solutions: ISolutions;
};

function StakedValue({
  value = 0,
  stakedNumber = 0,
  availableNumber = 0,
  tokenSymbol,
}: IStakedValue) {
  const totalNumber = stakedNumber + availableNumber;
  return (
    <YStack gap="$6" pb="$8" px="$5">
      <YStack gap="$2">
        <SizableText size="$headingLg">Staked value</SizableText>
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
              Staked
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
              Available
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
}: {
  tokenImageUri?: string;
  tokenSymbol: string;
  amount: string;
  statusText: string;
  onPress?: () => void;
  buttonText?: string;
}) => (
  <XStack alignItems="center" justifyContent="space-between">
    <XStack alignItems="center">
      <Token size="sm" tokenImageUri={tokenImageUri} />
      <XStack w="$1.5" />
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="value"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
      <XStack w="$1.5" />
      <XStack gap="$1" ai="center">
        <SizableText size="$bodyLg">{statusText}</SizableText>
      </XStack>
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
  pendingActive,
  claimable,
  token,
  onClaim,
  onPortfolioDetails,
}: IPortfolioValue) {
  if (
    Number(pendingInactive) > 0 ||
    Number(claimable) > 0 ||
    Number(pendingActive) > 0
  ) {
    return (
      <YStack pt="$3" pb="$8" gap="$6" px="$5">
        <XStack justifyContent="space-between">
          <SizableText size="$headingLg">Portfolio</SizableText>
          {onPortfolioDetails !== undefined ? (
            <Button
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              onPress={onPortfolioDetails}
            >
              Details
            </Button>
          ) : null}
        </XStack>
        <YStack gap="$3">
          {pendingInactive && Number(pendingInactive) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={pendingInactive}
              statusText="Pending"
            />
          ) : null}
          {pendingActive && Number(pendingActive) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={pendingActive}
              statusText="Activing"
            />
          ) : null}
          {claimable && Number(claimable) > 0 ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={claimable}
              statusText="Claimable"
              onPress={onClaim}
              buttonText="Claim"
            />
          ) : null}
        </YStack>
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
  return (
    <YStack py="$8" px="$5">
      <SizableText size="$headingLg">Profit</SizableText>
      <XStack $md={{ flexWrap: 'wrap' }}>
        <GridItem title="Rewards (%)" {...gridItemStyle}>
          <NumberSizeableText
            formatter="priceChange"
            formatterOptions={{ tokenSymbol: 'APR' }}
          >
            {apr}
          </NumberSizeableText>
        </GridItem>
        {earningsIn24h ? (
          <GridItem title="24h earnings" {...gridItemStyle}>
            <NumberSizeableText
              formatter="priceChange"
              formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
            >
              {earningsIn24h}
            </NumberSizeableText>
          </GridItem>
        ) : null}
        {rewardTokens ? (
          <GridItem title="Reward tokens" {...gridItemStyle}>
            {rewardTokens}
          </GridItem>
        ) : null}
        {updateFrequency ? (
          <GridItem title="Update frequency" {...gridItemStyle}>
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
  return (
    <YStack py="$8" px="$5">
      <SizableText size="$headingLg">Provider</SizableText>
      <XStack $md={{ flexWrap: 'wrap' }}>
        <GridItem title="Validator" {...gridItemStyle} link={validator.link}>
          {validator.name}
        </GridItem>
        {minStaking ? (
          <GridItem title="Min. staking" {...gridItemStyle}>
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
            title="Until next launch"
            tooltip={untilNextLaunch.tooltip}
            {...gridItemStyle}
          >
            <SizableText>
              <NumberSizeableText
                formatter="value"
                formatterOptions={{ tokenSymbol: untilNextLaunch.token }}
              >
                {untilNextLaunch.value}
              </NumberSizeableText>
              {' left'}
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
function FAQ({
  solutions,
}: {
  solutions: { question: string; answer: string }[];
}) {
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
        title: `This account doesn't support ${result?.networkName ?? ''}`,
        description:
          'Switch networks on the previous page or use a supported account',
      };
    }

    return {
      title: 'No Address',
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
              primary: 'Create',
              onPrimaryPress: () => handleCreateAddress(),
              isPrimaryLoading: isLoading,
            }
      }
    />
  );
}

type IUniversalProtocolDetails = {
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
  onPortfolioDetails?: () => void;
  onCreateAddress: () => void;
};

export function UniversalProtocolDetails({
  accountId,
  networkId,
  indexedAccountId,
  earnAccount,
  details,
  onClaim,
  onPortfolioDetails,
  onCreateAddress,
}: IUniversalProtocolDetails) {
  const result: IEarnTokenDetailResult | null = useMemo(() => {
    if (!details) {
      return null;
    }
    const provider: IProvider = {
      validator: {
        name: details.provider.name,
        link: details.provider.website,
      },
    };
    const portfolio: IPortfolioValue = {
      pendingInactive: details.pendingInactive,
      pendingActive: details.pendingActive,
      claimable: details.claimable,
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
        tooltip: 'tooltip',
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
      solutions: [
        {
          question: 'Lido 协议是如何工作的？',
          answer:
            'Lido 为传统 PoS 权益证明所带来的难题提供了一种创新解决方案，有效地降低了进入门槛和将资产锁定在单一协议中的成本。当用户将他们的资产存入 Lido 时，这些代币会通过协议在 Lido 多区块链上进行权益证明。',
        },
        {
          question: '为什么你会收到 stETH？',
          answer:
            '当你向 Lido 存入 ETH 时，你会收到 Lido 的流动性质押代币，即 stETH，它代表了你在 Lido 中对 ETH 的比例索赔。当在 Lido 上运行的验证者获得奖励时，你有资格按照你的质押比例获得奖励，这通常预期每天发生。',
        },
        {
          question: 'Lido 的可能风险是什么？',
          answer:
            '使用 Lido 进行质押存在一定的风险，例如网络或验证器故障可能导致质押资产的损失（罚款），或者 Lido 智能合约的漏洞或错误。尽管该代码已经开源，经过审计并得到广泛关注，但任何加密货币投资都存在风险，需要独立评估。',
        },
      ],
    };
    return data;
  }, [details]);

  if (!result) {
    return null;
  }

  const { solutions, stakedValue, portfolio, profit, provider } = result;
  return (
    <YStack>
      {earnAccount?.accountAddress ? (
        <>
          <StakedValue {...stakedValue} />
          <Portfolio
            {...portfolio}
            onClaim={onClaim}
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
