/* eslint-disable import-path/parent-depth */
import { type ReactNode, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IBadgeType,
  ISizableTextProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Accordion,
  Alert,
  Badge,
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';
import {
  ETransactionSecurityResultCode,
  type ITransactionSecurityCheckResult,
} from '@onekeyhq/shared/types/transactionSecurity';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { NetworkAvatar } from '../../../../../../components/NetworkAvatar';
import { Token } from '../../../../../../components/Token';
import { useAccountData } from '../../../../../../hooks/useAccountData';
import {
  DAppSiteMark,
  shouldHideDAppSiteRiskStyle,
} from '../../../../../DAppConnection/components/DAppRequestLayout';
import {
  SecurityCheckCard,
  TransactionPreview,
  buildSecurityCheckModel,
} from '../../../../../SignatureConfirm/components/SecurityCheckCard';

import { Layout } from './utils/Layout';

import type { ITokenProps } from '../../../../../../components/Token';

/*
  do not use this demo-only component
*/
function FakeWrapper({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      width="100%"
      maxWidth={640}
      alignSelf="center"
      p="$5"
      borderWidth={1}
      borderColor="$borderSubdued"
      {...rest}
    >
      {children}
    </YStack>
  );
}

/*
  Mock data for demo
*/
const MOCK_DATA = {
  alert: [
    'The spender is an EOA and may be a scam address',
    "You're using permit authorization, ensure the dApp is trustworthy to avoid asset loss.",
  ],
  items: [
    {
      type: 'network',
      label: 'Network',
      networkId: 'evm--1',
    },
    {
      type: 'address',
      label: 'Account address',
      address: '0x13b30304dAa2129a21e42df663e8f49C49b276e8',
      tags: [{ type: 'success', name: 'Wallet 1 / Account #1' }],
    },
    {
      type: 'address',
      label: 'To',
      address: '0x76f3f64cb3cd19debee51436df630a342b736c24',
      tags: [
        { type: 'critical', name: 'Contract' },
        { type: 'default', name: 'Uniswap V1' },
        { type: 'warning', name: 'Initial interact' },
      ],
    },
    {
      type: 'token',
      label: 'Asset',
      token: {
        type: 'ERC-20',
        address: '',
        isNative: true,
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        totalSupply: '',
        logoURI:
          'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
      },
      amount: '100',
      amountParsed: '1.000000000000000000',
      networkId: 'evm--1',
      showNetwork: false,
      editable: true,
    },
    {
      type: 'token',
      label: 'Pay',
      token: {
        type: 'ERC-20',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        isNative: false,
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        totalSupply: '',
        logoURI:
          'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      },
      amount: '100000',
      amountParsed: '0.100000',
      networkId: 'evm--1',
      showNetwork: true,
    },
    {
      type: 'nft',
      label: 'Asset',
      nft: {
        address: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
        type: 'ERC-721',
        id: '8762',
        isNative: false,
        name: 'BoredApeYachtClub',
        symbol: 'BAYC',
        decimals: null,
        totalSupply: '',
        logoURI: '',
        metadata: {
          image:
            'https://nft-cdn.alchemy.com/eth-mainnet/8abd7e99c75d2165047dd68583b4593b',
          source:
            'https://quicknode-content.quicknode-ipfs.com/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/8762',
          attributes: [
            { value: 'Discomfort', trait_type: 'Mouth' },
            { value: 'Silver Stud', trait_type: 'Earring' },
            { value: 'Robot', trait_type: 'Eyes' },
            { value: 'Sushi Chef Headband', trait_type: 'Hat' },
            { value: 'Prom Dress', trait_type: 'Clothes' },
            { value: 'Purple', trait_type: 'Background' },
            { value: 'Blue', trait_type: 'Fur' },
          ],
        },
      },
      amount: '1',
    },
    {
      type: 'nft',
      label: 'Asset',
      nft: {
        address: '0x22c36bfdcef207f9c0cc941936eff94d4246d14a',
        type: 'ERC-1155',
        id: '1',
        isNative: false,
        name: 'Bored Ape Chemistry Club',
        symbol: '',
        decimals: null,
        totalSupply: '',
        logoURI: '',
        metadata: {
          name: 'M2 Mutant Serum',
          image:
            'https://nft-cdn.alchemy.com/eth-mainnet/bc0be4896821c7f29b5bd6828632ea0e',
          source:
            'https://quicknode-content.quicknode-ipfs.com/ipfs/QmdtARLUPQeqXrVcNzQuRqr9UCFoFvn76X9cdTczt4vqfw/1',
          attributes: [{ value: 'M2', trait_type: 'Serum Type' }],
        },
      },
      amount: '2',
    },
  ],
};

/*
  Primitive item
*/
function SignatureDetailItemLabel(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" color="$textSubdued" {...props} />;
}

function SignatureDetailItemValue(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" {...props} />;
}

type ISignatureDetailItemType = IYStackProps;

function SignatureDetailItem(props: ISignatureDetailItemType) {
  return <YStack gap="$1" {...props} />;
}

SignatureDetailItem.Label = SignatureDetailItemLabel;
SignatureDetailItem.Value = SignatureDetailItemValue;

/*
  Address item
*/
function SignatureAddressDetailItem({
  label,
  address,
  tags,
  ...rest
}: {
  label: string;
  address: string;
  tags?: {
    type: IBadgeType;
    name: string;
  }[];
} & ISignatureDetailItemType) {
  return (
    <SignatureDetailItem {...rest}>
      <SignatureDetailItem.Label>{label}</SignatureDetailItem.Label>
      <SignatureDetailItem.Value>{address}</SignatureDetailItem.Value>
      {tags?.length ? (
        <XStack gap="$1">
          {tags.map((tag) => (
            <Badge key={tag.name} badgeType={tag.type}>
              {tag.name}
            </Badge>
          ))}
        </XStack>
      ) : null}
    </SignatureDetailItem>
  );
}

/*
  Network item
*/
function SignatureNetworkDetailItem({
  label,
  networkId,
  ...rest
}: {
  label: string;
  networkId: string;
} & ISignatureDetailItemType) {
  const { network } = useAccountData({ networkId });
  return (
    <SignatureDetailItem {...rest}>
      <SignatureDetailItem.Label>{label}</SignatureDetailItem.Label>
      <XStack gap="$2">
        <NetworkAvatar size="$5" networkId={networkId} />
        <SignatureDetailItem.Value>
          {network?.name ?? networkId}
        </SignatureDetailItem.Value>
      </XStack>
    </SignatureDetailItem>
  );
}

/*
  Asset item
*/
function SignatureAssetDetailItem({
  type,
  label,
  showNetwork,
  amount,
  symbol,
  editable,
  tokenProps,
  ...rest
}: {
  type?: 'token' | 'nft';
  label: string;
  amount: string;
  symbol: string;
  editable?: boolean;
  showNetwork?: boolean;
  tokenProps?: Omit<ITokenProps, 'size' | 'showNetworkIcon'>;
} & ISignatureDetailItemType) {
  return (
    <SignatureDetailItem {...rest}>
      <SignatureDetailItem.Label>{label}</SignatureDetailItem.Label>
      <XStack gap="$3" alignItems="center">
        <Token
          size="lg"
          showNetworkIcon={showNetwork}
          {...(type === 'nft' && {
            borderRadius: '$2',
          })}
          {...tokenProps}
        />
        <YStack>
          <XStack
            gap="$1"
            alignItems="center"
            {...(editable && {
              onPress: () => {
                console.log('clicked');
              },
              p: '$1',
              m: '$-1',
              borderRadius: '$2',
              userSelect: 'none',
              hoverStyle: {
                bg: '$bgSubdued',
              },
              pressStyle: {
                bg: '$bgActive',
              },
              focusable: true,
              focusVisibleStyle: {
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 0,
              },
            })}
          >
            {amount ? (
              <SizableText size="$headingMd">{amount}</SizableText>
            ) : null}
            <SizableText size="$bodyLg">{symbol}</SizableText>
            {editable ? (
              <Icon name="PencilOutline" size="$4.5" color="$iconSubdued" />
            ) : null}
          </XStack>
          {showNetwork ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              Ethereum
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </SignatureDetailItem>
  );
}

function DataViewer() {
  return (
    <ScrollView
      p="$2.5"
      borderRadius="$2.5"
      borderCurve="continuous"
      bg="$bgSubdued"
      h="$60"
    >
      <SizableText size="$bodySm">jason data here...</SizableText>
    </ScrollView>
  );
}

function SignatureMessageSection() {
  return (
    <SignatureDetailItem
      pt="$5"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      <SignatureDetailItem.Label>Message</SignatureDetailItem.Label>
      <DataViewer />
    </SignatureDetailItem>
  );
}

function SignatureAdvanceSection() {
  return (
    <YStack
      pt="$5"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      <Accordion type="multiple" collapsable>
        <Accordion.Item value="advance">
          <Accordion.Trigger
            unstyled
            flexDirection="row"
            alignItems="center"
            alignSelf="flex-start"
            px="$1"
            mx="$-1"
            borderWidth={0}
            bg="$transparent"
            userSelect="none"
            borderRadius="$1"
            hoverStyle={{
              bg: '$bgSubdued',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: 0,
            }}
          >
            {({ open }: { open: boolean }) => (
              <>
                <SizableText size="$bodyMd" color="$textSubdued">
                  Advance
                </SizableText>
                <YStack
                  transition="quick"
                  animateOnly={ANIMATE_ONLY_TRANSFORM}
                  rotate={open ? '180deg' : '0deg'}
                >
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$5"
                  />
                </YStack>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator transition="quick">
            <Accordion.Content
              unstyled
              pt="$2.5"
              gap="$5"
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            >
              <YStack gap="$2.5">
                <XStack>
                  <XStack gap="$4" flex={1}>
                    {[
                      { isActive: true, title: 'Data' },
                      { isActive: false, title: 'ABI' },
                      { isActive: false, title: 'Hex' },
                    ].map((item) => (
                      <YStack
                        key={item.title}
                        px="$1"
                        mx="$-1"
                        userSelect="none"
                        borderRadius="$1"
                        hoverStyle={{
                          bg: '$bgSubdued',
                        }}
                        pressStyle={{
                          bg: '$bgActive',
                        }}
                        focusVisibleStyle={{
                          outlineColor: '$focusRing',
                          outlineWidth: 2,
                          outlineStyle: 'solid',
                          outlineOffset: 0,
                        }}
                        onPress={() => {
                          console.log('clicked');
                        }}
                      >
                        <SizableText
                          size={item.isActive ? '$bodyMdMedium' : '$bodyMd'}
                          color={item.isActive ? '$text' : '$textSubdued'}
                        >
                          {item.title}
                        </SizableText>
                      </YStack>
                    ))}
                  </XStack>
                  <IconButton
                    variant="tertiary"
                    icon="Copy3Outline"
                    size="small"
                  />
                </XStack>
                <DataViewer />
              </YStack>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

/*
  Demo
*/
function YourComponentDemo() {
  return (
    <FakeWrapper gap="$5">
      {/* maps alerts */}
      {MOCK_DATA.alert.map((alert) => (
        <Alert
          key={alert}
          description={alert}
          type="warning"
          icon="InfoSquareOutline"
        />
      ))}

      {/* site mark */}
      <DAppSiteMark origin="https://uniswap.org" />

      {/* map items */}
      {MOCK_DATA.items.map((item, index) => {
        const itemKey = `${item.type}-${item.label}-${index}`;
        if (item.type === 'address') {
          return (
            <SignatureAddressDetailItem
              key={itemKey}
              label={item.label}
              address={item.address ?? ''}
              tags={item.tags?.map((tag) => ({
                ...tag,
                type: tag.type as IBadgeType,
              }))}
            />
          );
        }

        if (item.type === 'network') {
          return (
            <SignatureNetworkDetailItem
              key={itemKey}
              label={item.label}
              networkId={item.networkId ?? ''}
            />
          );
        }

        if (item.type === 'token' || item.type === 'nft') {
          return (
            <SignatureAssetDetailItem
              key={itemKey}
              type={item.type}
              label={item.label}
              tokenProps={{
                tokenImageUri: item.token?.logoURI,
                networkId: item.networkId,
                ...(item.type === 'nft' && {
                  tokenImageUri: item.nft?.metadata?.image,
                }),
              }}
              showNetwork={item.showNetwork}
              amount={
                !item.amount || item.nft?.type === 'ERC-721' ? '' : item.amount
              }
              symbol={
                item.token?.symbol ||
                item.nft?.metadata?.name ||
                (item.nft?.id ? `#${item.nft.id}` : '') ||
                ''
              }
              editable={item.editable}
            />
          );
        }

        return (
          <SignatureDetailItem key={itemKey}>
            <SignatureDetailItem.Label>{item.label}</SignatureDetailItem.Label>
            <SignatureDetailItem.Value>
              {/* @ts-expect-error - fallback case */}
              {item.value || ''}
            </SignatureDetailItem.Value>
          </SignatureDetailItem>
        );
      })}

      {/* Custom item */}
      <SignatureDetailItem>
        <XStack
          alignSelf="flex-start"
          gap="$1.5"
          px="$1"
          mx="$-1"
          alignItems="center"
          userSelect="none"
          borderRadius="$1"
          hoverStyle={{
            bg: '$bgSubdued',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusable
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: 0,
          }}
          onPress={() => {
            console.log('clicked');
          }}
        >
          <SignatureDetailItem.Label>Resource</SignatureDetailItem.Label>
          <Icon name="InfoCircleOutline" size="$4.5" color="$iconSubdued" />
        </XStack>
        <SignatureDetailItem.Value>
          0 Energy + 268 Energy
        </SignatureDetailItem.Value>
        <SizableText color="$textSubdued" size="$bodySm">
          The fee required for this transaction will be automatically deducted
        </SizableText>
      </SignatureDetailItem>

      {/* Message */}
      <SignatureMessageSection />

      {/* Advance */}
      <SignatureAdvanceSection />
    </FakeWrapper>
  );
}

const GALLERY_HOST_VERIFIED = {
  host: 'app.uniswap.org',
  level: EHostSecurityLevel.Security,
  attackTypes: [],
  phishingSite: false,
  checkSources: [],
  alert: '',
  projectName: 'Uniswap',
  createdAt: '',
} as IHostSecurity;
const GALLERY_HOST_SAFE_DEMO = {
  ...GALLERY_HOST_VERIFIED,
  host: 'swap-demo.example',
  projectName: 'Example Swap',
} as IHostSecurity;
const GALLERY_HOST_UNVERIFIED = {
  ...GALLERY_HOST_VERIFIED,
  host: 'permit-dapp.example',
  level: EHostSecurityLevel.Unknown,
  projectName: '',
} as IHostSecurity;
const GALLERY_HOST_PHISHING = {
  ...GALLERY_HOST_VERIFIED,
  host: 'approval-phishing.example',
  level: EHostSecurityLevel.High,
  phishingSite: true,
  alert: 'This site is known for approval phishing.',
  projectName: '',
  detail: {
    title: 'Approval phishing',
    content: 'Other visitors lost funds after signing on lookalike domains.',
  },
} as IHostSecurity;
const GALLERY_HOST_WARNING = {
  ...GALLERY_HOST_VERIFIED,
  host: 'new-dapp.example',
  level: EHostSecurityLevel.Medium,
  alert: 'This site has unusual traffic for a first-time visit.',
  projectName: '',
  detail: {
    title: 'Unusual first-visit traffic',
    content: 'Similar domains were used in approval phishing this week.',
  },
} as IHostSecurity;
const GALLERY_SCAN_SECURITY: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Security,
  detail: { code: 'security', features: [] },
};
const GALLERY_SCAN_UNKNOWN: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Unknown,
  detail: {
    code: ETransactionSecurityResultCode.UnableToAssess,
    features: [],
  },
};
const GALLERY_SCAN_FAILED: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Unknown,
  detail: { code: ETransactionSecurityResultCode.CheckFailed, features: [] },
};
const GALLERY_SCAN_UNAVAILABLE: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Unknown,
  detail: {
    code: ETransactionSecurityResultCode.CheckUnavailable,
    features: [],
  },
};
const GALLERY_SCAN_NETWORK_NOT_SUPPORTED: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Unknown,
  detail: {
    code: ETransactionSecurityResultCode.NetworkNotSupported,
    features: [],
  },
};
const GALLERY_SCAN_WARNING: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Medium,
  detail: {
    code: 'new_spender',
    title: 'The spender has not been seen before.',
    content: 'Review the spender before approving this request.',
    features: [
      {
        level: EHostSecurityLevel.Medium,
        code: 'new_spender',
        title: 'Spender not seen before',
        content: 'This address has little transaction history.',
      },
    ],
  },
};
const GALLERY_SCAN_DRAIN: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.High,
  detail: {
    code: 'approval_drain',
    title: 'The spender can move your full USDC balance.',
    content: 'This approval stays valid until you revoke it.',
    features: [
      {
        level: EHostSecurityLevel.High,
        code: 'unlimited_approval',
        title: 'Unlimited USDC allowance',
        content: 'The spender can transfer the full balance.',
        address: '0x111122223333444455556666777788889999aaaa',
      },
      {
        level: EHostSecurityLevel.Medium,
        code: 'new_spender',
        title: 'Spender not seen before',
      },
    ],
  },
};

function galleryDecodedTx(alerts: string[] = []): IDecodedTx {
  return {
    txid: 'gallery',
    owner: '0x13b30304dAa2129a21e42df663e8f49C49b276e8',
    signer: '0x13b30304dAa2129a21e42df663e8f49C49b276e8',
    nonce: 1,
    actions: [],
    status: 'Pending',
    networkId: 'evm--1',
    accountId: 'gallery',
    extraInfo: null,
    isLocalParsed: false,
    isConfirmationRequired: false,
    txDisplay: {
      title: 'Approval',
      components: [],
      alerts,
    },
  } as IDecodedTx;
}

const GALLERY_PERMIT_MESSAGE: IUnsignedMessage = {
  type: EMessageTypesEth.TYPED_DATA_V4,
  message: JSON.stringify({ primaryType: 'Permit' }),
};

const GALLERY_SIMULATION: IDisplayComponentSimulation[] = [
  {
    type: EParseTxComponentType.Simulation,
    label: '',
    assets: [
      {
        type: EParseTxComponentType.InternalAssets,
        label: '',
        name: 'Ethereum',
        icon: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
        symbol: 'ETH',
        amount: '',
        amountParsed: '0.12',
        transferDirection: ETransferDirection.Out,
      },
      {
        type: EParseTxComponentType.InternalAssets,
        label: '',
        name: 'USD Coin',
        icon: 'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
        symbol: 'USDC',
        amount: '',
        amountParsed: '240.00',
        transferDirection: ETransferDirection.In,
      },
    ],
  },
];

function GallerySecurityCheckCard({
  onRetry,
  urlSecurityInfo = GALLERY_HOST_VERIFIED,
  decodedTxs,
  transactionSecurityInfo,
  isTransactionSecurityPending,
  isTransactionSecurityApplicable,
  isPrimeUser,
}: {
  onRetry?: () => void;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  transactionSecurityInfo?: ITransactionSecurityCheckResult;
  isTransactionSecurityPending?: boolean;
  isTransactionSecurityApplicable?: boolean;
  isPrimeUser?: boolean;
}) {
  const intl = useIntl();
  return (
    <SecurityCheckCard
      model={buildSecurityCheckModel({
        kind: 'transaction',
        origin: `https://${urlSecurityInfo.host}`,
        urlSecurityInfo,
        decodedTxs: decodedTxs ?? [galleryDecodedTx()],
        transactionSecurityInfo,
        isTransactionSecurityPending,
        isTransactionSecurityApplicable,
        isPrimeUser,
        intl,
      })}
      onRetry={onRetry}
    />
  );
}

const GALLERY_ACCOUNT_TAGS = [
  { type: 'success' as const, name: 'Wallet 1 / Account #1' },
];

function SignatureCase({
  children,
  showSimulation = true,
  urlSecurityInfo = GALLERY_HOST_VERIFIED,
  networkId = 'evm--1',
  testID,
}: {
  children: ReactNode;
  showSimulation?: boolean;
  urlSecurityInfo?: IHostSecurity;
  networkId?: string;
  testID?: string;
}) {
  return (
    <FakeWrapper gap="$5" testID={testID}>
      <DAppSiteMark
        origin={`https://${urlSecurityInfo.host}`}
        urlSecurityInfo={urlSecurityInfo}
        hideRiskStyle={shouldHideDAppSiteRiskStyle(urlSecurityInfo)}
      />
      {children}
      {showSimulation ? (
        <TransactionPreview simulationComponents={GALLERY_SIMULATION} />
      ) : null}
      <SignatureNetworkDetailItem label="Network" networkId={networkId} />
      <SignatureAddressDetailItem
        label="Account address"
        address="0x13b30304dAa2129a21e42df663e8f49C49b276e8"
        tags={GALLERY_ACCOUNT_TAGS}
      />
    </FakeWrapper>
  );
}

function ApprovalCriticalDemo() {
  return (
    <SignatureCase
      testID="signature-gallery-critical-combined"
      urlSecurityInfo={GALLERY_HOST_PHISHING}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_PHISHING}
        transactionSecurityInfo={GALLERY_SCAN_DRAIN}
        isPrimeUser
      />
    </SignatureCase>
  );
}

function ApprovalPrimeWarningDemo() {
  return (
    <SignatureCase
      testID="signature-gallery-warning-prime"
      urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
        transactionSecurityInfo={GALLERY_SCAN_WARNING}
        isPrimeUser
      />
    </SignatureCase>
  );
}

function ApprovalWarningCheckingDemo() {
  return (
    <SignatureCase
      testID="signature-gallery-loading-warning"
      urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
        decodedTxs={[
          galleryDecodedTx(['The spender is an EOA and may be a scam address']),
        ]}
        isTransactionSecurityPending
        isPrimeUser
      />
    </SignatureCase>
  );
}

function ApprovalUnknownDemo() {
  return (
    <SignatureCase
      testID="signature-gallery-unable-assess"
      urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
        transactionSecurityInfo={GALLERY_SCAN_UNKNOWN}
        isPrimeUser
      />
    </SignatureCase>
  );
}

function ApprovalSuccessDemo() {
  return (
    <SignatureCase testID="signature-gallery-safe-prime">
      <GallerySecurityCheckCard
        transactionSecurityInfo={GALLERY_SCAN_SECURITY}
        isPrimeUser
      />
    </SignatureCase>
  );
}

function ApprovalSuccessFreeDemo() {
  return (
    <SignatureCase testID="signature-gallery-safe-free">
      <GallerySecurityCheckCard
        isPrimeUser={false}
        isTransactionSecurityApplicable
      />
    </SignatureCase>
  );
}

function ApprovalLoadingDemo() {
  return (
    <SignatureCase testID="signature-gallery-loading">
      <GallerySecurityCheckCard isTransactionSecurityPending isPrimeUser />
    </SignatureCase>
  );
}

function ApprovalViewAllDemo() {
  return (
    <SignatureCase
      testID="signature-gallery-view-all"
      urlSecurityInfo={GALLERY_HOST_WARNING}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_WARNING}
        decodedTxs={[
          galleryDecodedTx([
            'The spender has not been seen before.',
            'The spender is an EOA and may be a scam address',
            'This approval stays valid until you revoke it.',
          ]),
        ]}
        isPrimeUser={false}
        isTransactionSecurityApplicable
      />
    </SignatureCase>
  );
}

function PermitDemo({
  testID,
  urlSecurityInfo,
}: {
  testID: string;
  urlSecurityInfo: IHostSecurity;
}) {
  const intl = useIntl();
  return (
    <SignatureCase
      showSimulation={false}
      testID={testID}
      urlSecurityInfo={urlSecurityInfo}
    >
      <SecurityCheckCard
        model={buildSecurityCheckModel({
          kind: 'message',
          origin: `https://${urlSecurityInfo.host}`,
          urlSecurityInfo,
          messageDisplay: {
            title: 'Permit',
            components: [],
            alerts: [
              intl.formatMessage({
                id: ETranslations.dapp_connect_permit_sign_alert,
              }),
            ],
          },
          unsignedMessage: GALLERY_PERMIT_MESSAGE,
          isConfirmationRequired: true,
          isTransactionSecurityApplicable: true,
          isPrimeUser: false,
          intl,
        })}
      />
    </SignatureCase>
  );
}

function MessageParseFallbackDemo() {
  const intl = useIntl();
  return (
    <SignatureCase
      showSimulation={false}
      testID="signature-gallery-message-fallback"
    >
      <SecurityCheckCard
        model={buildSecurityCheckModel({
          kind: 'message',
          origin: `https://${GALLERY_HOST_VERIFIED.host}`,
          urlSecurityInfo: GALLERY_HOST_VERIFIED,
          messageDisplay: {
            title: 'Message',
            components: [],
            alerts: [],
          },
          isMessageParseFallback: true,
          isTransactionSecurityApplicable: false,
          isPrimeUser: false,
          intl,
        })}
      />
    </SignatureCase>
  );
}

function ApprovalCheckFailedDemo() {
  const [isRetrying, setIsRetrying] = useState(false);
  return (
    <SignatureCase
      testID="signature-gallery-check-failed"
      urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
        transactionSecurityInfo={isRetrying ? undefined : GALLERY_SCAN_FAILED}
        isTransactionSecurityPending={isRetrying}
        isPrimeUser
        onRetry={() => setIsRetrying(true)}
      />
    </SignatureCase>
  );
}

function ApprovalUnavailableDemo() {
  return (
    <SignatureCase
      testID="signature-gallery-prime-unavailable"
      urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
        transactionSecurityInfo={GALLERY_SCAN_UNAVAILABLE}
        isPrimeUser
      />
    </SignatureCase>
  );
}

function ApprovalNetworkNotSupportedDemo() {
  return (
    <SignatureCase
      showSimulation={false}
      networkId="evm--61"
      testID="signature-gallery-network-unsupported"
      urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
    >
      <GallerySecurityCheckCard
        urlSecurityInfo={GALLERY_HOST_SAFE_DEMO}
        transactionSecurityInfo={GALLERY_SCAN_NETWORK_NOT_SUPPORTED}
        isPrimeUser
      />
    </SignatureCase>
  );
}

const SignatureConfirmationGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="SignatureConfirmation"
    elements={[
      {
        title: 'Loading · Prime scan pending',
        element: <ApprovalLoadingDemo />,
      },
      {
        title: 'Loading · Existing warning stays visible',
        element: <ApprovalWarningCheckingDemo />,
      },
      {
        title: 'Safe · Free user',
        element: <ApprovalSuccessFreeDemo />,
      },
      {
        title: 'Safe · Prime checked',
        element: <ApprovalSuccessDemo />,
      },
      {
        title: 'Warning · Prime transaction security',
        element: <ApprovalPrimeWarningDemo />,
      },
      {
        title: 'Permit · Trusted site',
        element: (
          <PermitDemo
            testID="signature-gallery-permit-trusted"
            urlSecurityInfo={GALLERY_HOST_VERIFIED}
          />
        ),
      },
      {
        title: 'Permit · Unverified site',
        element: (
          <PermitDemo
            testID="signature-gallery-permit-unverified"
            urlSecurityInfo={GALLERY_HOST_UNVERIFIED}
          />
        ),
      },
      {
        title: 'Critical · Site and transaction security',
        element: <ApprovalCriticalDemo />,
      },
      {
        title: 'Unverified · Unable to assess',
        element: <ApprovalUnknownDemo />,
      },
      {
        title: 'Unverified · Message parsing fallback',
        element: <MessageParseFallbackDemo />,
      },
      {
        title: 'Incomplete · Retry',
        element: <ApprovalCheckFailedDemo />,
      },
      {
        title: 'Coverage · Prime unavailable',
        element: <ApprovalUnavailableDemo />,
      },
      {
        title: 'Coverage · Network not supported',
        element: <ApprovalNetworkNotSupportedDemo />,
      },
      {
        title: 'View all · Four findings',
        element: <ApprovalViewAllDemo />,
      },
      {
        title: 'Legacy · Signature detail primitives',
        element: <YourComponentDemo />,
      },
    ]}
  />
);

export default SignatureConfirmationGallery;
