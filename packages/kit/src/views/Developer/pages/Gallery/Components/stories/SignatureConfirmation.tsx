/* eslint-disable import-path/parent-depth */
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

import { NetworkAvatar } from '../../../../../../components/NetworkAvatar';
import { Token } from '../../../../../../components/Token';
import { DAppSiteMark } from '../../../../../DAppConnection/components/DAppRequestLayout';

import { Layout } from './utils/Layout';

import type { ITokenProps } from '../../../../../../components/Token';

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
                <YStack animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$5"
                  />
                </YStack>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              unstyled
              pt="$2.5"
              gap="$5"
              animation="quick"
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

const SignatureConfirmationGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="SignatureConfirmation"
    elements={[
      {
        title: 'Default',
        element: <YourComponentDemo />,
      },
    ]}
  />
);

export default SignatureConfirmationGallery;
