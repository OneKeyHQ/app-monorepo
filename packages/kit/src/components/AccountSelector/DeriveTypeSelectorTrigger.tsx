import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem, ISelectProps } from '@onekeyhq/components';
import { Select } from '@onekeyhq/components';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';

type IDeriveTypeSelectorTriggerPropsBase = {
  renderTrigger?: ISelectProps<ISelectItem>['renderTrigger'];
  placement?: ComponentProps<typeof Select>['placement'];
};
type IDeriveTypeSelectorTriggerProps = IDeriveTypeSelectorTriggerPropsBase & {
  items: IAccountDeriveInfoItems[];
  value?: IAccountDeriveTypes; // value
  onChange?: (type: IAccountDeriveTypes) => void;
};

function DeriveTypeSelectorTriggerView({
  items,
  value: deriveType,
  onChange: onDeriveTypeChange,
  renderTrigger,
  placement,
  testID,
}: IDeriveTypeSelectorTriggerProps & {
  testID?: string;
}) {
  const intl = useIntl();

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
        renderTrigger={renderTrigger}
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
  const intl = useIntl();
  const { result: viewItems } = usePromiseResult(async () => {
    const selectItems =
      await backgroundApiProxy.serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
        enabledItems: items,
      });
    return selectItems;
  }, [items, networkId]);
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
      items={options}
      value={deriveType}
      onChange={onDeriveTypeChange}
      {...others}
    />
  );
}

export function DeriveTypeSelectorTrigger({
  num,
  renderTrigger,
  placement,
}: IDeriveTypeSelectorTriggerPropsBase & {
  num: number;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [isStorageReady] = useAccountSelectorStorageReadyAtom();
  const { activeAccount } = useActiveAccount({ num });
  const { deriveInfoItems, deriveInfo, deriveType, wallet, network } =
    activeAccount;
  const walletId = wallet?.id;
  const networkId = network?.id;

  const options = useMemo(
    () =>
      deriveInfoItems
        .map(({ value, label, item, description, descI18n }) => ({
          value,
          label: item.labelKey
            ? intl.formatMessage({ id: item.labelKey })
            : label,
          item,
          description: descI18n
            ? intl.formatMessage({ id: descI18n?.id }, descI18n?.data)
            : description,
        }))
        .filter((info) => {
          if (info.item.disableWalletTypes && wallet?.type) {
            return !info.item.disableWalletTypes.includes(wallet?.type);
          }
          return true;
        }),
    [deriveInfoItems, intl, wallet?.type],
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
    <DeriveTypeSelectorTriggerView
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

export function DeriveTypeSelectorTriggerStandAlone({
  networkId,
  renderTrigger,
  placement,
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
    <DeriveTypeSelectorTriggerView
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
