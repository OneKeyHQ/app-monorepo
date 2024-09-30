import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem, ISelectProps } from '@onekeyhq/components';
import {
  Form,
  Icon,
  IconButton,
  Select,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePrevious } from '../../hooks/usePrevious';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';

import type { GestureResponderEvent } from 'react-native';

type IDeriveTypeSelectorTriggerPropsBase = {
  renderTrigger?: ISelectProps<ISelectItem>['renderTrigger'];
  defaultTriggerInputProps?: ISelectProps<ISelectItem>['defaultTriggerInputProps'];
  placement?: ComponentProps<typeof Select>['placement'];
  offset?: ISelectProps<ISelectItem>['offset'];
  visibleOnNetworks?: string[];
  networkId?: string;
};
type IDeriveTypeSelectorTriggerProps = IDeriveTypeSelectorTriggerPropsBase & {
  items: IAccountDeriveInfoItems[];
  value?: IAccountDeriveTypes; // value
  onChange?: (type: IAccountDeriveTypes) => void;
};

function DeriveTypeVisibleController({
  networkId,
  visibleOnNetworks,
  children,
}: {
  networkId: string | undefined;
  visibleOnNetworks?: string[];
  children: (params: {
    visible: boolean;
    setVisible: (v: boolean) => void;
  }) => React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);

  const usedVisible = useMemo(() => {
    if (networkUtils.isAllNetwork({ networkId })) {
      return false;
    }
    if (visibleOnNetworks?.length && networkId) {
      return visibleOnNetworks.includes(networkId);
    }
    return visible;
  }, [networkId, visible, visibleOnNetworks]);

  return (
    <Stack
      position={!usedVisible ? 'absolute' : 'relative'}
      height={!usedVisible ? 0 : undefined}
      width={!usedVisible ? 0 : undefined}
      opacity={!usedVisible ? 0 : undefined}
      overflow={!usedVisible ? 'hidden' : undefined}
    >
      {children({ visible, setVisible })}
    </Stack>
  );
}

function DeriveTypeSelectorTriggerBaseView({
  items,
  value: deriveType,
  onChange: onDeriveTypeChange,
  renderTrigger,
  placement,
  testID,
  offset,
  defaultTriggerInputProps,
  visibleOnNetworks,
  networkId,
}: IDeriveTypeSelectorTriggerProps & {
  testID?: string;
}) {
  const intl = useIntl();

  return (
    <DeriveTypeVisibleController
      networkId={networkId}
      visibleOnNetworks={visibleOnNetworks}
    >
      {() => (
        <Select
          offset={offset}
          testID={testID}
          items={items}
          floatingPanelProps={{
            width: '$78',
          }}
          placement={placement}
          value={deriveType}
          onChange={onDeriveTypeChange}
          title={intl.formatMessage({ id: ETranslations.derivation_path })}
          renderTrigger={renderTrigger}
          defaultTriggerInputProps={defaultTriggerInputProps}
        />
      )}
    </DeriveTypeVisibleController>
  );
}

// for AccountSelector Jotai Context
export function DeriveTypeSelectorTrigger({
  num,
  renderTrigger,
  placement,
  focusedWalletId,
}: IDeriveTypeSelectorTriggerPropsBase & {
  num: number;
  focusedWalletId?: string;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [isStorageReady] = useAccountSelectorStorageReadyAtom();
  const { activeAccount } = useActiveAccount({ num });
  const { deriveInfoItems, deriveInfo, deriveType, wallet, network } =
    activeAccount;
  const walletId = focusedWalletId || wallet?.id;
  const networkId = network?.id;

  const options = useMemo(
    () =>
      deriveInfoItems.map(({ value, label, item, description, descI18n }) => ({
        value,
        label: item.labelKey
          ? intl.formatMessage({ id: item.labelKey })
          : label,
        item,
        description: descI18n
          ? intl.formatMessage({ id: descI18n?.id }, descI18n?.data)
          : description,
      })),
    [deriveInfoItems, intl],
  );

  if (!isStorageReady) {
    return null;
  }

  if (options.length <= 1) {
    return null;
  }

  if (!walletId) {
    return null;
  }

  if (walletId && accountUtils.isOthersWallet({ walletId })) {
    return null;
  }

  return (
    <DeriveTypeSelectorTriggerBaseView
      networkId={networkId}
      visibleOnNetworks={networkUtils.getDefaultDeriveTypeVisibleNetworks()}
      key={`${deriveType || ''}-${networkId || ''}-${
        deriveInfo?.template || ''
      }`}
      testID={`derive-type-selector-trigger-${accountUtils.beautifyPathTemplate(
        { template: deriveInfo?.template || '' },
      )}`}
      value={deriveType}
      items={options}
      onChange={async (type) => {
        await actions.current.updateSelectedAccountDeriveType({
          num,
          deriveType: type,
        });
      }}
      renderTrigger={renderTrigger}
      placement={placement}
    />
  );
}

function DeriveTypeSelectorTriggerIconRenderer({
  label,
  autoShowLabel,
  onPress,
}: {
  label?: string | undefined;
  autoShowLabel?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
}) {
  const media = useMedia();
  const hitSlop = platformEnv.isNative
    ? {
        right: 16,
        top: 16,
        bottom: 16,
      }
    : undefined;
  return (
    <XStack
      testID="wallet-derivation-path-selector-trigger"
      role="button"
      borderRadius="$2"
      userSelect="none"
      alignItems="center"
      p="$1"
      my="$-1"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineOffset: 0,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      hitSlop={hitSlop}
      onPress={onPress}
      focusable
    >
      <Icon name="BranchesOutline" color="$iconSubdued" size="$4.5" />
      {media.gtSm && autoShowLabel ? (
        <SizableText pl="$2" pr="$1" size="$bodyMd" color="$textSubdued">
          {label}
        </SizableText>
      ) : null}
    </XStack>
  );
}

export function DeriveTypeSelectorTriggerForHome({ num }: { num: number }) {
  return (
    <DeriveTypeSelectorTrigger
      renderTrigger={({ label, onPress }) => (
        <DeriveTypeSelectorTriggerIconRenderer
          label={label}
          autoShowLabel
          onPress={onPress}
        />
      )}
      num={num}
    />
  );
}

export function DeriveTypeSelectorTriggerForDapp({
  num,
  focusedWalletId,
}: {
  num: number;
  focusedWalletId?: string;
}) {
  return (
    <DeriveTypeSelectorTrigger
      placement="bottom-end"
      renderTrigger={({ label, onPress }) => (
        <IconButton
          onPress={onPress}
          icon="BranchesOutline"
          variant="tertiary"
        />
      )}
      num={num}
      focusedWalletId={focusedWalletId}
    />
  );
}

export function DeriveTypeSelectorTriggerGlobalStandAlone({
  networkId,
  renderTrigger,
  placement,
  offset,
}: {
  networkId: string;
} & IDeriveTypeSelectorTriggerPropsBase) {
  const [deriveTypeChangedTs, setDeriveTypeChangedTs] = useState(0);
  const { result: options = [] } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      }),
    [networkId],
  );
  const { result: deriveType = undefined } = usePromiseResult(async () => {
    noopObject(deriveTypeChangedTs);
    const globalDeriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId,
      });
    return globalDeriveType;
  }, [networkId, deriveTypeChangedTs]);
  return (
    <DeriveTypeSelectorTriggerBaseView
      offset={offset}
      value={deriveType}
      items={options}
      onChange={async (type) => {
        await backgroundApiProxy.serviceNetwork.saveGlobalDeriveTypeForNetwork({
          networkId: networkId || '',
          deriveType: type,
        });
        setDeriveTypeChangedTs(Date.now());
      }}
      renderTrigger={renderTrigger}
      placement={placement}
    />
  );
}

export function DeriveTypeSelectorFormInput(
  props: Omit<IDeriveTypeSelectorTriggerProps, 'items'> & {
    enabledItems?: IAccountDeriveInfo[];
    networkId: string;
    onItemsChange?: (items: IAccountDeriveInfoItems[]) => void;
    hideIfItemsLTEOne?: boolean; // <=1
  },
) {
  const {
    hideIfItemsLTEOne,
    enabledItems,
    networkId,
    value: deriveType,
    onChange: onDeriveTypeChange,
    onItemsChange,
    ...others
  } = props;
  const intl = useIntl();
  const { result: viewItems } = usePromiseResult(async () => {
    const selectItems =
      await backgroundApiProxy.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
        enabledItems,
      });
    return selectItems;
  }, [enabledItems, networkId]);
  const options = useMemo(
    () =>
      viewItems?.map(({ value, label, item, description, descI18n }) => ({
        value,
        label: item.labelKey
          ? intl.formatMessage({ id: item.labelKey })
          : label,
        description: descI18n
          ? intl.formatMessage({ id: descI18n?.id }, descI18n?.data)
          : description,
        item,
      })) || [],
    [intl, viewItems],
  );

  const prevDeriveType = usePrevious(deriveType);
  const isDeriveTypeSame = deriveType === prevDeriveType;
  const isDeriveTypeSameRef = useRef(isDeriveTypeSame);
  isDeriveTypeSameRef.current = isDeriveTypeSame;
  const shouldResetDeriveTypeWhenNetworkChanged = useRef(false);
  const deriveTypeRef = useRef(deriveType);
  deriveTypeRef.current = deriveType;

  useEffect(() => {
    if (deriveTypeRef.current && isDeriveTypeSameRef.current) {
      shouldResetDeriveTypeWhenNetworkChanged.current = true;
    }
  }, [networkId]);

  // autofix derivetype when it's not in the list or not set value yet
  useEffect(() => {
    void (async () => {
      if (
        shouldResetDeriveTypeWhenNetworkChanged.current ||
        !deriveType ||
        (viewItems?.length &&
          !viewItems.find((item) => item.value === deriveType))
      ) {
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        let fixedValue = viewItems?.[0].value as IAccountDeriveTypes;
        if (
          defaultDeriveType &&
          viewItems?.length &&
          viewItems.find((item) => item.value === defaultDeriveType)
        ) {
          fixedValue = defaultDeriveType;
        }
        shouldResetDeriveTypeWhenNetworkChanged.current = false;
        onDeriveTypeChange?.(fixedValue);
      }
    })();
  }, [deriveType, networkId, onDeriveTypeChange, viewItems]);

  onItemsChange?.(options);

  if (!viewItems) {
    return null;
  }

  return (
    <DeriveTypeSelectorTriggerBaseView
      key={`${deriveType || ''}-${networkId || ''}`}
      items={options}
      networkId={networkId}
      value={deriveType}
      onChange={onDeriveTypeChange}
      {...others}
      renderTrigger={
        hideIfItemsLTEOne && options.length <= 1
          ? () => <Stack />
          : others.renderTrigger
      }
    />
  );
}

export function DeriveTypeSelectorFormField({
  networkId,
  fieldName,
}: {
  networkId: string | undefined;
  fieldName: string;
}) {
  const intl = useIntl();
  const media = useMedia();
  return (
    <DeriveTypeVisibleController networkId={networkId}>
      {({ setVisible, visible }) => (
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.global_derivation_path,
          })}
          name={fieldName}
        >
          <DeriveTypeSelectorFormInput
            hideIfItemsLTEOne
            onItemsChange={(items) => {
              const shouldVisible = items.length > 1;
              if (visible !== shouldVisible) {
                setVisible(shouldVisible);
              }
            }}
            networkId={networkId || ''}
            defaultTriggerInputProps={{
              size: media.gtMd ? 'medium' : 'large',
            }}
          />
        </Form.Field>
      )}
    </DeriveTypeVisibleController>
  );
}
