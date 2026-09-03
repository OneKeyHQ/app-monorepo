/* eslint-disable import-path/parent-depth */
import { type ReactNode, useMemo, useState } from 'react';

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
  Button,
  Checkbox,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import {
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponent,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';
import type { ITransactionSecurityCheckResult } from '@onekeyhq/shared/types/transactionSecurity';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { NetworkAvatar } from '../../../../../../components/NetworkAvatar';
import { Token } from '../../../../../../components/Token';
import { DAppSiteMark } from '../../../../../DAppConnection/components/DAppRequestLayout';
import {
  SecurityCheckCard,
  TransactionPreview,
  buildSecurityCheckModel,
} from '../../../../../SignatureConfirm/components/SecurityCheckCard';

import { Layout } from './utils/Layout';

import type { ITokenProps } from '../../../../../../components/Token';
import type {
  ISecurityCheckCategory,
  ISecurityCheckConfirmation,
  ISecurityCheckFinding,
  ISecurityCheckViewModel,
} from '../../../../../SignatureConfirm/components/SecurityCheckCard/securityCheckModel';

/*
  do not use this demo-only component
*/
function FakeWrapper({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      w={640}
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
  return (
    <SignatureDetailItem {...rest}>
      <SignatureDetailItem.Label>{label}</SignatureDetailItem.Label>
      <XStack gap="$2">
        <NetworkAvatar size="$5" networkId={networkId} />
        <SignatureDetailItem.Value>Ethereum</SignatureDetailItem.Value>
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
      {MOCK_DATA.items.map((item) => {
        if (item.type === 'address') {
          return (
            <SignatureAddressDetailItem
              key={item.label}
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
              key={item.label}
              label={item.label}
              networkId={item.networkId ?? ''}
            />
          );
        }

        if (item.type === 'token' || item.type === 'nft') {
          return (
            <SignatureAssetDetailItem
              key={item.label}
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
          <SignatureDetailItem key={item.label}>
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

const GALLERY_EMPTY_FINDINGS: ISecurityCheckFinding[] = [];
const GALLERY_EMPTY_GROUPED = {
  site: GALLERY_EMPTY_FINDINGS,
  operation: GALLERY_EMPTY_FINDINGS,
};

const GALLERY_WARNING_FINDING: ISecurityCheckFinding = {
  id: 'gallery-warning',
  category: 'operation',
  status: 'warning',
  title: 'The spender has not been seen before.',
};

const GALLERY_SITE_WARNING_FINDING: ISecurityCheckFinding = {
  id: 'gallery-site-warning',
  category: 'site',
  status: 'warning',
  title: 'This site has unusual traffic for a first-time visit.',
  description: 'Similar domains were used in approval phishing this week.',
};

const GALLERY_ALLOWANCE_INFO_FINDING: ISecurityCheckFinding = {
  id: 'gallery-allowance-info',
  category: 'operation',
  status: 'info',
  title: 'This request asks for an unlimited USDC allowance.',
  description: 'The spender can move your full USDC balance until revoked.',
};

const GALLERY_CONTRACT_UNKNOWN_FINDING: ISecurityCheckFinding = {
  id: 'gallery-contract-unknown',
  category: 'operation',
  status: 'unknown',
  title: 'The spender contract could not be verified.',
};

const GALLERY_SITE_CRITICAL_FINDING: ISecurityCheckFinding = {
  id: 'gallery-site-critical',
  category: 'site',
  status: 'critical',
  title: 'This site is known for approval phishing.',
  description: 'Other visitors lost funds after signing on lookalike domains.',
};

const GALLERY_DRAIN_CRITICAL_FINDING: ISecurityCheckFinding = {
  id: 'gallery-drain-critical',
  category: 'operation',
  status: 'critical',
  title: 'The spender can move your full USDC balance.',
  description: 'This approval stays valid until you revoke it.',
};

const GALLERY_SITE_UNKNOWN_FINDING: ISecurityCheckFinding = {
  id: 'gallery-site-unknown',
  category: 'site',
  status: 'unknown',
  title: 'This site could not be verified.',
};

const GALLERY_WARNING_FINDINGS = [GALLERY_WARNING_FINDING];
const GALLERY_WARNING_GROUPED = {
  site: GALLERY_EMPTY_FINDINGS,
  operation: GALLERY_WARNING_FINDINGS,
};

const GALLERY_APPROVAL_WARNING_FINDINGS = [
  GALLERY_SITE_WARNING_FINDING,
  GALLERY_WARNING_FINDING,
  GALLERY_ALLOWANCE_INFO_FINDING,
  GALLERY_CONTRACT_UNKNOWN_FINDING,
];
const GALLERY_APPROVAL_CRITICAL_FINDINGS = [
  GALLERY_SITE_CRITICAL_FINDING,
  GALLERY_DRAIN_CRITICAL_FINDING,
  GALLERY_ALLOWANCE_INFO_FINDING,
  GALLERY_CONTRACT_UNKNOWN_FINDING,
];
const GALLERY_APPROVAL_UNKNOWN_FINDINGS = [
  GALLERY_SITE_UNKNOWN_FINDING,
  GALLERY_CONTRACT_UNKNOWN_FINDING,
];

function groupGalleryFindings(findings: ISecurityCheckFinding[]) {
  return {
    site: findings.filter((finding) => finding.category === 'site'),
    operation: findings.filter((finding) => finding.category === 'operation'),
  };
}

function galleryCategories(findings: ISecurityCheckFinding[]) {
  const grouped = groupGalleryFindings(findings);
  return (['site', 'operation'] as ISecurityCheckCategory[]).filter(
    (category) => grouped[category].length > 0,
  );
}

const GALLERY_APPROVAL_WARNING_GROUPED = groupGalleryFindings(
  GALLERY_APPROVAL_WARNING_FINDINGS,
);
const GALLERY_APPROVAL_CRITICAL_GROUPED = groupGalleryFindings(
  GALLERY_APPROVAL_CRITICAL_FINDINGS,
);
const GALLERY_APPROVAL_UNKNOWN_GROUPED = groupGalleryFindings(
  GALLERY_APPROVAL_UNKNOWN_FINDINGS,
);

const GALLERY_ORIGIN = 'https://app.uniswap.org';
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
const GALLERY_HOST_PHISHING = {
  ...GALLERY_HOST_VERIFIED,
  level: EHostSecurityLevel.High,
  phishingSite: true,
  alert: 'This site is known for approval phishing.',
  detail: {
    title: 'Approval phishing',
    content: 'Other visitors lost funds after signing on lookalike domains.',
  },
} as IHostSecurity;
const GALLERY_SCAN_SECURITY: ITransactionSecurityCheckResult = {
  level: EHostSecurityLevel.Security,
  detail: { code: 'security', features: [] },
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
        address: '0x000000000022d473030f116ddee9f6b43ac78ba3',
      },
      {
        level: EHostSecurityLevel.Medium,
        code: 'new_spender',
        title: 'Spender not seen before',
      },
    ],
  },
};
const GALLERY_SPENDER_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const GALLERY_SPENDER_ADDRESS_COMPONENT: IDisplayComponent = {
  type: EParseTxComponentType.Address,
  label: 'Approve to',
  address: GALLERY_SPENDER_ADDRESS,
  tags: [{ value: 'Suspicious spender', displayType: 'warning' }],
};

function galleryDecodedTx({
  alerts = [],
  components = [],
  isConfirmationRequired = false,
}: {
  alerts?: string[];
  components?: IDisplayComponent[];
  isConfirmationRequired?: boolean;
} = {}): IDecodedTx {
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
    isConfirmationRequired,
    txDisplay: {
      title: 'Approval',
      components,
      alerts,
    },
  } as IDecodedTx;
}

const GALLERY_FAILED_FINDING: ISecurityCheckFinding = {
  id: 'tx-security-check-failed',
  category: 'operation',
  status: 'unknown',
  title: 'Check failed',
};

const GALLERY_FAILED_FINDINGS = [GALLERY_FAILED_FINDING];
const GALLERY_FAILED_GROUPED = {
  site: GALLERY_EMPTY_FINDINGS,
  operation: GALLERY_FAILED_FINDINGS,
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
        icon: '',
        symbol: 'ETH',
        amount: '',
        amountParsed: '0.12',
        transferDirection: ETransferDirection.Out,
      },
      {
        type: EParseTxComponentType.InternalAssets,
        label: '',
        name: 'USD Coin',
        icon: '',
        symbol: 'USDC',
        amount: '',
        amountParsed: '240.00',
        transferDirection: ETransferDirection.In,
      },
    ],
  },
];

function buildGalleryModel(
  overrides: Partial<ISecurityCheckViewModel>,
): ISecurityCheckViewModel {
  return {
    kind: 'transaction',
    confirmation: 'none',
    findings: GALLERY_EMPTY_FINDINGS,
    groupedFindings: GALLERY_EMPTY_GROUPED,
    orderedCategories: [],
    coverageTitle: 'Site security · Transaction analysis',
    statusSourceTitle: 'Site security · Transaction analysis',
    isPending: false,
    hasTransactionSecurityCheck: false,
    shouldShowNoIssue: false,
    showTargetedScanGap: false,
    defaultExpanded: false,
    ...overrides,
  };
}

const GALLERY_ACCOUNT_TAGS = [
  { type: 'success' as const, name: 'Wallet 1 / Account #1' },
];
const GALLERY_SPENDER_WARNING_TAGS = [
  { type: 'warning' as const, name: 'Suspicious spender' },
];

function GalleryLabeledCase({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$2" pb="$6">
      <SizableText size="$bodyMdMedium">{title}</SizableText>
      {children}
    </YStack>
  );
}

function ApprovalDecisionFooter({
  confirmation,
}: {
  confirmation: ISecurityCheckConfirmation;
}) {
  const intl = useIntl();
  const [checked, setChecked] = useState(false);
  const showAlert = confirmation !== 'none' && confirmation !== 'pending';
  const isRisk = confirmation === 'risk';
  const confirmDisabled = confirmation === 'pending' || (showAlert && !checked);

  return (
    <YStack
      gap="$3"
      pt="$4"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      {showAlert ? (
        <Checkbox
          label={intl.formatMessage({
            id: isRisk
              ? ETranslations.dapp_connect_proceed_at_my_own_risk
              : ETranslations.dapp_connect_security_checks_reviewed_authorization_details__text,
          })}
          value={checked}
          onChange={(value) => setChecked(Boolean(value))}
        />
      ) : null}
      <XStack gap="$2.5" justifyContent="flex-end">
        <Button variant="secondary">
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        <Button
          variant={isRisk ? 'destructive' : 'primary'}
          disabled={confirmDisabled}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>
    </YStack>
  );
}

function ApprovalCase({
  children,
  showSimulation = true,
  urlSecurityInfo,
  spenderAddress,
  spenderTags,
  confirmation,
  showAllowance = false,
}: {
  children: ReactNode;
  showSimulation?: boolean;
  urlSecurityInfo?: IHostSecurity;
  spenderAddress?: string;
  spenderTags?: { type: IBadgeType; name: string }[];
  confirmation?: ISecurityCheckConfirmation;
  showAllowance?: boolean;
}) {
  const hideSiteRisk =
    urlSecurityInfo?.level === EHostSecurityLevel.High ||
    urlSecurityInfo?.level === EHostSecurityLevel.Medium;
  return (
    <FakeWrapper gap="$5">
      <DAppSiteMark
        origin={GALLERY_ORIGIN}
        urlSecurityInfo={urlSecurityInfo}
        hideRiskStyle={hideSiteRisk}
      />
      {children}
      {showSimulation ? (
        <TransactionPreview simulationComponents={GALLERY_SIMULATION} />
      ) : null}
      <SignatureNetworkDetailItem label="Network" networkId="evm--1" />
      <SignatureAddressDetailItem
        label="Account address"
        address="0x13b30304dAa2129a21e42df663e8f49C49b276e8"
        tags={GALLERY_ACCOUNT_TAGS}
      />
      {spenderAddress ? (
        <SignatureAddressDetailItem
          label="Approve to"
          address={spenderAddress}
          tags={spenderTags}
        />
      ) : null}
      {showAllowance ? (
        <>
          <SignatureDetailItem>
            <SignatureDetailItem.Label>Allowance</SignatureDetailItem.Label>
            <SignatureDetailItem.Value>
              Unlimited USDC
            </SignatureDetailItem.Value>
          </SignatureDetailItem>
          <SignatureDetailItem>
            <SignatureDetailItem.Label>Expiry</SignatureDetailItem.Label>
            <SignatureDetailItem.Value>Until revoked</SignatureDetailItem.Value>
          </SignatureDetailItem>
        </>
      ) : null}
      {confirmation !== undefined ? (
        <ApprovalDecisionFooter confirmation={confirmation} />
      ) : null}
    </FakeWrapper>
  );
}

function ApprovalCriticalDemo() {
  return (
    <ApprovalCase confirmation="risk">
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'critical',
          confirmation: 'risk',
          findings: GALLERY_APPROVAL_CRITICAL_FINDINGS,
          groupedFindings: GALLERY_APPROVAL_CRITICAL_GROUPED,
          orderedCategories: galleryCategories(
            GALLERY_APPROVAL_CRITICAL_FINDINGS,
          ),
          hasTransactionSecurityCheck: true,
          isPrimeUser: false,
        })}
      />
    </ApprovalCase>
  );
}

function ApprovalWarningDemo() {
  return (
    <ApprovalCase confirmation="risk">
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'warning',
          confirmation: 'risk',
          findings: GALLERY_APPROVAL_WARNING_FINDINGS,
          groupedFindings: GALLERY_APPROVAL_WARNING_GROUPED,
          orderedCategories: galleryCategories(
            GALLERY_APPROVAL_WARNING_FINDINGS,
          ),
          hasTransactionSecurityCheck: true,
          isPrimeUser: false,
        })}
      />
    </ApprovalCase>
  );
}

function ApprovalWarningCheckingDemo() {
  return (
    <ApprovalCase>
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'warning',
          confirmation: 'pending',
          isPending: true,
          findings: GALLERY_APPROVAL_WARNING_FINDINGS,
          groupedFindings: GALLERY_APPROVAL_WARNING_GROUPED,
          orderedCategories: galleryCategories(
            GALLERY_APPROVAL_WARNING_FINDINGS,
          ),
          hasTransactionSecurityCheck: true,
        })}
      />
    </ApprovalCase>
  );
}

function ApprovalUnknownDemo() {
  return (
    <ApprovalCase>
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'unknown',
          findings: GALLERY_APPROVAL_UNKNOWN_FINDINGS,
          groupedFindings: GALLERY_APPROVAL_UNKNOWN_GROUPED,
          orderedCategories: galleryCategories(
            GALLERY_APPROVAL_UNKNOWN_FINDINGS,
          ),
          hasTransactionSecurityCheck: true,
        })}
      />
    </ApprovalCase>
  );
}

function ApprovalSuccessDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_VERIFIED,
        decodedTxs: [galleryDecodedTx()],
        transactionSecurityInfo: GALLERY_SCAN_SECURITY,
        isPrimeUser: true,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase urlSecurityInfo={GALLERY_HOST_VERIFIED}>
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalSuccessFreeDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_VERIFIED,
        decodedTxs: [galleryDecodedTx()],
        isPrimeUser: false,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase
      urlSecurityInfo={GALLERY_HOST_VERIFIED}
      confirmation={model.confirmation}
    >
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalRequestDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_VERIFIED,
        decodedTxs: [galleryDecodedTx({ isConfirmationRequired: true })],
        transactionSecurityInfo: GALLERY_SCAN_SECURITY,
        isPrimeUser: false,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase
      urlSecurityInfo={GALLERY_HOST_VERIFIED}
      spenderAddress={GALLERY_SPENDER_ADDRESS}
      showAllowance
      confirmation={model.confirmation}
    >
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalCriticalFreeDemo() {
  return (
    <ApprovalCase>
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'critical',
          confirmation: 'risk',
          findings: GALLERY_APPROVAL_CRITICAL_FINDINGS,
          groupedFindings: GALLERY_APPROVAL_CRITICAL_GROUPED,
          orderedCategories: galleryCategories(
            GALLERY_APPROVAL_CRITICAL_FINDINGS,
          ),
          hasTransactionSecurityCheck: false,
          isPrimeUser: false,
        })}
      />
    </ApprovalCase>
  );
}

function ApprovalSiteOnlyDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_PHISHING,
        decodedTxs: [galleryDecodedTx()],
        transactionSecurityInfo: GALLERY_SCAN_SECURITY,
        isPrimeUser: true,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase urlSecurityInfo={GALLERY_HOST_PHISHING}>
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalRequestScanOnlyDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_VERIFIED,
        decodedTxs: [galleryDecodedTx()],
        transactionSecurityInfo: GALLERY_SCAN_DRAIN,
        isPrimeUser: true,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase urlSecurityInfo={GALLERY_HOST_VERIFIED}>
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalParserOnlyDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_VERIFIED,
        decodedTxs: [
          galleryDecodedTx({
            alerts: ['The spender is an EOA and may be a scam address'],
          }),
        ],
        isPrimeUser: false,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase urlSecurityInfo={GALLERY_HOST_VERIFIED}>
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalAddressTagOnlyDemo() {
  const intl = useIntl();
  const model = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: GALLERY_ORIGIN,
        urlSecurityInfo: GALLERY_HOST_VERIFIED,
        decodedTxs: [
          galleryDecodedTx({
            components: [GALLERY_SPENDER_ADDRESS_COMPONENT],
          }),
        ],
        transactionSecurityInfo: GALLERY_SCAN_SECURITY,
        isPrimeUser: true,
        intl,
      }),
    [intl],
  );
  return (
    <ApprovalCase
      urlSecurityInfo={GALLERY_HOST_VERIFIED}
      spenderAddress={GALLERY_SPENDER_ADDRESS}
      spenderTags={GALLERY_SPENDER_WARNING_TAGS}
    >
      <SecurityCheckCard model={model} />
    </ApprovalCase>
  );
}

function ApprovalLoadingDemo() {
  return (
    <ApprovalCase confirmation="pending">
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'loading',
          confirmation: 'pending',
          isPending: true,
          hasTransactionSecurityCheck: true,
          isPrimeUser: false,
        })}
      />
    </ApprovalCase>
  );
}

const GALLERY_RETRY_SECURITY_CHECK = () => {};

function ApprovalCheckFailedDemo() {
  return (
    <ApprovalCase showSimulation={false} confirmation="none">
      <SecurityCheckCard
        model={buildGalleryModel({
          status: 'check_failed',
          findings: GALLERY_FAILED_FINDINGS,
          groupedFindings: GALLERY_FAILED_GROUPED,
          orderedCategories: ['operation'],
          hasTransactionSecurityCheck: false,
          isPrimeUser: false,
        })}
        onRetry={GALLERY_RETRY_SECURITY_CHECK}
      />
    </ApprovalCase>
  );
}

function SecurityCheckCardGalleryStates() {
  return (
    <YStack gap="$5" w={420} maxWidth="100%">
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          No simulation · success · Prime
        </SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            kind: 'message',
            status: 'success',
            shouldShowNoIssue: true,
            hasTransactionSecurityCheck: true,
            isPrimeUser: true,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          No simulation · success · free
        </SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            kind: 'message',
            status: 'success',
            shouldShowNoIssue: true,
            hasTransactionSecurityCheck: false,
            isPrimeUser: false,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          No simulation · success · no targeted scan
        </SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            kind: 'message',
            status: 'success',
            shouldShowNoIssue: true,
            showTargetedScanGap: true,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Loading · no simulation</SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            kind: 'message',
            status: 'loading',
            confirmation: 'pending',
            isPending: true,
            statusSourceTitle: 'Signature analysis',
            isPrimeUser: false,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Critical · findings</SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            status: 'critical',
            confirmation: 'risk',
            findings: GALLERY_APPROVAL_CRITICAL_FINDINGS,
            groupedFindings: GALLERY_APPROVAL_CRITICAL_GROUPED,
            orderedCategories: galleryCategories(
              GALLERY_APPROVAL_CRITICAL_FINDINGS,
            ),
            hasTransactionSecurityCheck: true,
            isPrimeUser: false,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Warning · findings</SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            kind: 'message',
            status: 'warning',
            confirmation: 'risk',
            findings: GALLERY_WARNING_FINDINGS,
            groupedFindings: GALLERY_WARNING_GROUPED,
            orderedCategories: ['operation'],
            statusSourceTitle: 'Signature analysis',
            isPrimeUser: false,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Unknown · header only</SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            status: 'unknown',
            findings: GALLERY_APPROVAL_UNKNOWN_FINDINGS,
            groupedFindings: GALLERY_APPROVAL_UNKNOWN_GROUPED,
            orderedCategories: galleryCategories(
              GALLERY_APPROVAL_UNKNOWN_FINDINGS,
            ),
            hasTransactionSecurityCheck: true,
          })}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Simulation only · success
        </SizableText>
        <YStack gap="$5">
          <SecurityCheckCard
            model={buildGalleryModel({
              status: 'success',
              hasTransactionSecurityCheck: true,
              shouldShowNoIssue: true,
            })}
          />
          <TransactionPreview simulationComponents={GALLERY_SIMULATION} />
        </YStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Simulation only · success · no targeted scan
        </SizableText>
        <YStack gap="$5">
          <SecurityCheckCard
            model={buildGalleryModel({
              status: 'success',
              hasTransactionSecurityCheck: false,
              shouldShowNoIssue: true,
              showTargetedScanGap: true,
            })}
          />
          <TransactionPreview simulationComponents={GALLERY_SIMULATION} />
        </YStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Findings + simulation · warning
        </SizableText>
        <YStack gap="$5">
          <SecurityCheckCard
            model={buildGalleryModel({
              status: 'warning',
              confirmation: 'risk',
              findings: GALLERY_WARNING_FINDINGS,
              groupedFindings: GALLERY_WARNING_GROUPED,
              orderedCategories: ['operation'],
              defaultExpanded: true,
              hasTransactionSecurityCheck: true,
              isPrimeUser: false,
            })}
          />
          <TransactionPreview simulationComponents={GALLERY_SIMULATION} />
        </YStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Loading + simulation</SizableText>
        <YStack gap="$5">
          <SecurityCheckCard
            model={buildGalleryModel({
              status: 'loading',
              confirmation: 'pending',
              isPending: true,
              hasTransactionSecurityCheck: true,
              isPrimeUser: false,
            })}
          />
          <TransactionPreview simulationComponents={GALLERY_SIMULATION} />
        </YStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Check failed · no simulation
        </SizableText>
        <SecurityCheckCard
          model={buildGalleryModel({
            status: 'check_failed',
            findings: GALLERY_FAILED_FINDINGS,
            groupedFindings: GALLERY_FAILED_GROUPED,
            orderedCategories: ['operation'],
            hasTransactionSecurityCheck: false,
            isPrimeUser: false,
          })}
          onRetry={GALLERY_RETRY_SECURITY_CHECK}
        />
      </YStack>
    </YStack>
  );
}

const SignatureConfirmationGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="SignatureConfirmation"
    elements={[
      {
        title: 'Core · Loading',
        element: <ApprovalLoadingDemo />,
      },
      {
        title: 'Core · Success',
        element: <ApprovalSuccessFreeDemo />,
      },
      {
        title: 'Core · Info / request',
        element: <ApprovalRequestDemo />,
      },
      {
        title: 'Core · Warning',
        element: <ApprovalWarningDemo />,
      },
      {
        title: 'Core · Critical',
        element: <ApprovalCriticalDemo />,
      },
      {
        title: 'Core · Check failed',
        element: <ApprovalCheckFailedDemo />,
      },
      {
        title: 'Source variants',
        element: (
          <YStack>
            <GalleryLabeledCase title="Success · Prime">
              <ApprovalSuccessDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Critical · free">
              <ApprovalCriticalFreeDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Warning · checking">
              <ApprovalWarningCheckingDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Unknown">
              <ApprovalUnknownDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Site only">
              <ApprovalSiteOnlyDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Request scan only">
              <ApprovalRequestScanOnlyDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Parser only">
              <ApprovalParserOnlyDemo />
            </GalleryLabeledCase>
            <GalleryLabeledCase title="Address tag only">
              <ApprovalAddressTagOnlyDemo />
            </GalleryLabeledCase>
          </YStack>
        ),
      },
      {
        title: 'Card-only states',
        element: <SecurityCheckCardGalleryStates />,
      },
      {
        title: 'Primitive coverage',
        element: <YourComponentDemo />,
      },
    ]}
  />
);

export default SignatureConfirmationGallery;
