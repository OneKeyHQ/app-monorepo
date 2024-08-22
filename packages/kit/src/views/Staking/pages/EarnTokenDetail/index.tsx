import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Accordion,
  Heading,
  Icon,
  NumberSizeableText,
  Page,
  Progress,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

type IStakedValue = {
  value: number;
  stakedNumber: number;
  avaliableNumber: number;
};

enum EPortfolioActionType {
  WithdrawalRequested = 'WithdrawalRequested',
  PendingActivation = 'PendingActivation',
  Active = 'Active',
}

type IPortfolioItem = {
  tokenId: string;
  tokenNumber: number;
  tokenSymbol: string;
  actionType: EPortfolioActionType;
};

type IProfit = {
  reward: string;
  earningsIn24h: string;
  rewardTokens: string;
  updateFrequency: number;
};

type IProvider = {
  validator: {
    name: string;
    link: string;
  };
  minStaking: {
    value: number;
    token: string;
  };
  untilNexLaunch: {
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
  portfolio: IPortfolioItem[];
  profit: IProfit;
  provider: IProvider;
  solutions: ISolutions;
};

function StakedValue({
  value = 0,
  stakedNumber = 0,
  avaliableNumber = 0,
}: IStakedValue) {
  const totalNumber = stakedNumber + avaliableNumber;
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
          {value}
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
              formatterOptions={{ tokenSymbol: 'ETH' }}
            >
              {stakedNumber}
            </NumberSizeableText>
          </YStack>
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSuccess" textAlign="right">
              Available
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ tokenSymbol: 'ETH' }}
            >
              {avaliableNumber}
            </NumberSizeableText>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

function Portfolio({ messages = [] }: { messages: IPortfolioItem[] }) {
  const renderText = useCallback((actionType: EPortfolioActionType) => {
    switch (actionType) {
      case EPortfolioActionType.Active:
        return 'Active';
      case EPortfolioActionType.PendingActivation:
        return 'Pending Activation';
      case EPortfolioActionType.WithdrawalRequested:
        return 'Withdrawal requested';
      default: {
        return '';
      }
    }
  }, []);
  const renderTooltipText = useCallback((actionType: EPortfolioActionType) => {
    let tooltip = '';
    switch (actionType) {
      case EPortfolioActionType.Active:
        tooltip = '123';
        break;
      case EPortfolioActionType.PendingActivation:
        tooltip = '456';
        break;
      case EPortfolioActionType.WithdrawalRequested:
      default:
        tooltip = '';
        break;
    }
    return tooltip ? (
      <Tooltip
        placement="top"
        renderContent={tooltip}
        renderTrigger={<Icon name="InfoCircleOutline" size="$5" />}
      />
    ) : null;
  }, []);
  return (
    <YStack pt="$3" pb="$8" gap="$6" px="$5">
      <SizableText size="$headingLg">Portfolio</SizableText>
      {messages.length
        ? messages.map(({ tokenId, tokenNumber, actionType }) => (
            <YStack gap="$3" key={tokenId}>
              <XStack gap="$1.5">
                <Token
                  size="sm"
                  tokenImageUri="https://uni.onekey-asset.com/static/chain/btc.png"
                />
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="value"
                  formatterOptions={{ tokenSymbol: 'ETH' }}
                >
                  {tokenNumber}
                </NumberSizeableText>
                <XStack gap="$1" ai="center">
                  <SizableText size="$bodyLg">
                    {renderText(actionType)}
                  </SizableText>
                  {renderTooltipText(actionType)}
                </XStack>
              </XStack>
            </YStack>
          ))
        : null}
    </YStack>
  );
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
  reward,
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
            {reward}
          </NumberSizeableText>
        </GridItem>
        <GridItem title="24h earnings" {...gridItemStyle}>
          <NumberSizeableText
            formatter="priceChange"
            formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
          >
            {earningsIn24h}
          </NumberSizeableText>
        </GridItem>
        <GridItem title="Reward tokens" {...gridItemStyle}>
          {rewardTokens}
        </GridItem>
        <GridItem title="Update frequency" {...gridItemStyle}>
          {`~${updateFrequency}days`}
        </GridItem>
      </XStack>
    </YStack>
  );
}

export function Provider({ validator, minStaking, untilNexLaunch }: IProvider) {
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
        <GridItem title="Min. staking" {...gridItemStyle}>
          <NumberSizeableText
            formatter="value"
            formatterOptions={{ tokenSymbol: minStaking.token }}
          >
            {minStaking.value}
          </NumberSizeableText>
        </GridItem>
        <GridItem
          title="Until next launch"
          tooltip={untilNexLaunch.tooltip}
          {...gridItemStyle}
        >
          <SizableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ tokenSymbol: untilNexLaunch.token }}
            >
              {untilNexLaunch.value}
            </NumberSizeableText>
            {' left'}
          </SizableText>
        </GridItem>
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

export default function EarnTokenDetail({
  route,
}: IPageScreenProps<
  IModalStakingParamList,
  EModalStakingRoutes.EarnTokenDetail
>) {
  const { networkId } = route.params || {};
  console.log(networkId);
  const { result } = usePromiseResult<
    IEarnTokenDetailResult | undefined
  >(async () => {
    switch (networkId) {
      case 'evm--1':
        return {
          stakedValue: {
            value: 100,
            stakedNumber: 1,
            avaliableNumber: 3,
          },
          portfolio: [
            {
              tokenId: '',
              tokenNumber: 3,
              tokenSymbol: 'ETH',
              actionType: EPortfolioActionType.PendingActivation,
            },
            {
              tokenId: '',
              tokenNumber: 1.2,
              tokenSymbol: 'ETH',
              actionType: EPortfolioActionType.WithdrawalRequested,
            },
            {
              tokenId: '',
              tokenNumber: 3.2,
              tokenSymbol: 'ETH',
              actionType: EPortfolioActionType.Active,
            },
          ],
          profit: {
            reward: '3.67',
            earningsIn24h: '0.125454',
            rewardTokens: 'ETH',
            updateFrequency: 1,
          },
          provider: {
            validator: {
              name: 'Everstake',
              link: 'https://1key.so',
            },
            minStaking: {
              value: 0.1,
              token: 'ETH',
            },
            untilNexLaunch: {
              value: 28.1,
              token: 'ETH',
              tooltip: 'tooltip',
            },
          },
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
        } as IEarnTokenDetailResult;
      default:
        return undefined;
    }
  }, [networkId]);

  if (!result) {
    return null;
  }

  const { solutions, stakedValue, portfolio, profit, provider } = result;
  return (
    <Page
      scrollEnabled
      onClose={() => {
        console.log('onClose');
      }}
    >
      <Page.Header title="Earn ETH" />
      <Page.Body>
        <YStack>
          <StakedValue {...stakedValue} />
          <Portfolio messages={portfolio} />
          <Profit {...profit} />
          <Provider {...provider} />
          <FAQ solutions={solutions} />
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Stake"
        onCancelText="Withdraw"
        onConfirm={() => {
          console.log('confirm');
        }}
        onCancel={() => {
          console.log('cancel');
        }}
      />
    </Page>
  );
}
