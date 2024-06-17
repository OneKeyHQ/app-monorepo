import type { ComponentProps } from 'react';
import { useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem, ISelectProps } from '@onekeyhq/components';
import { IconButton, Select } from '@onekeyhq/components';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

type IDeriveTypeSelectorTriggerPropsBase = {
  miniMode?: boolean;
  renderTrigger?: ISelectProps<ISelectItem>['renderTrigger'];
  placement?: ComponentProps<typeof Select>['placement'];
};
type IDeriveTypeSelectorTriggerProps = IDeriveTypeSelectorTriggerPropsBase & {
  items: IAccountDeriveInfoItems[];
  value?: IAccountDeriveTypes; // value
  onChange?: (type: IAccountDeriveTypes) => void;
};

const renderMiniModeTrigger = () => (
  <IconButton
    title={appLocale.intl.formatMessage({
      id: ETranslations.global_switch_address,
    })}
    icon="RepeatOutline"
    size="small"
    variant="tertiary"
    iconProps={{
      size: '$4.5',
    }}
    mx="$0"
    $platform-native={{
      hitSlop: {
        right: 8,
        top: 8,
        bottom: 8,
      },
    }}
  />
);

function DeriveTypeSelectorTriggerView({
  items,
  value: deriveType,
  onChange: onDeriveTypeChange,
  miniMode,
  renderTrigger,
  placement,
  testID,
}: IDeriveTypeSelectorTriggerProps & {
  testID?: string;
}) {
  const intl = useIntl();
  const renderTriggerElement = useMemo(() => {
    if (renderTrigger) {
      return renderTrigger;
    }
    if (miniMode) {
      return renderMiniModeTrigger;
    }
    return undefined;
  }, [miniMode, renderTrigger]);

  return (
    <>
      <Select
        testID={testID}
        items={items}
        floatingPanelProps={{
          width: '$78',
        }}
        placement={placement}
        value={deriveType}
        onChange={onDeriveTypeChange}
        title={intl.formatMessage({ id: ETranslations.derivation_path })}
        renderTrigger={renderTriggerElement}
      />
    </>
  );
}

export function DeriveTypeSelectorTriggerStaticInput(
  props: Omit<IDeriveTypeSelectorTriggerProps, 'items'> & {
    items: IAccountDeriveInfo[];
    networkId: string;
  },
) {
  const {
    items,
    networkId,
    value: deriveType,
    onChange: onDeriveTypeChange,
    ...others
  } = props;
  const { result: viewItems } = usePromiseResult(async () => {
    const selectItems =
      await backgroundApiProxy.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
        enabledItems: items,
      });
    return selectItems;
  }, [items, networkId]);

  // autofix derivetype when it's not in the list
  useEffect(() => {
    if (
      viewItems?.length &&
      !viewItems.find((item) => item.value === deriveType)
    ) {
      const fixedValue = viewItems?.[0].value as IAccountDeriveTypes;
      onDeriveTypeChange?.(fixedValue);
    }
  }, [deriveType, onDeriveTypeChange, viewItems]);

  if (!viewItems) {
    return null;
  }

  return (
    <DeriveTypeSelectorTriggerView
      key={`${deriveType || ''}-${networkId || ''}`}
      items={viewItems}
      value={deriveType}
      onChange={onDeriveTypeChange}
      {...others}
    />
  );
}

export function DeriveTypeSelectorTrigger({
  num,
  miniMode,
  renderTrigger,
  placement,
}: IDeriveTypeSelectorTriggerPropsBase & {
  num: number;
}) {
  const intl = useIntl();
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const {
    activeAccount: { deriveInfoItems, deriveInfo, wallet },
  } = useActiveAccount({ num });

  const options = useMemo(
    () =>
      deriveInfoItems
        .map(({ value, label, item, ...i }) => ({
          value,
          label: item.labelKey
            ? intl.formatMessage({ id: item.labelKey })
            : label,
          item,
          ...i,
        }))
        .filter((info) => {
          if (info.item.disableWalletTypes && wallet?.type) {
            return !info.item.disableWalletTypes.includes(wallet?.type);
          }
          return true;
        }),
    [deriveInfoItems, intl, wallet?.type],
  );

  console.log('__deriveInfoItems', deriveInfoItems);

  if (!selectedAccount.walletId) {
    return null;
  }

  if (accountUtils.isOthersWallet({ walletId: selectedAccount.walletId })) {
    return null;
  }

  if (!isReady) {
    return null;
  }

  return (
    <DeriveTypeSelectorTriggerView
      key={`${selectedAccount.deriveType || ''}-${
        selectedAccount.networkId || ''
      }-${deriveInfo?.template || ''}`}
      testID={`derive-type-selector-trigger-${accountUtils.beautifyPathTemplate(
        { template: deriveInfo?.template || '' },
      )}`}
      value={selectedAccount.deriveType}
      items={options}
      onChange={(type) =>
        actions.current.updateSelectedAccountDeriveType({
          num,
          deriveType: type as any,
        })
      }
      miniMode={miniMode}
      renderTrigger={renderTrigger}
      placement={placement}
    />
  );
}
