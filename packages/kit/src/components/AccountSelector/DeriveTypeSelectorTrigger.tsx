import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem, ISelectProps } from '@onekeyhq/components';
import { IconButton, Select, SizableText } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

const renderMiniModeTrigger = () => (
  <IconButton
    title="Switch Address"
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

export function DeriveTypeSelectorTrigger({
  num,
  miniMode,
  renderTrigger,
  placement,
}: {
  num: number;
  miniMode?: boolean;
  renderTrigger?: ISelectProps<ISelectItem>['renderTrigger'];
  placement?: ComponentProps<typeof Select>['placement'];
}) {
  const intl = useIntl();
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const {
    activeAccount: { deriveInfoItems, deriveInfo },
  } = useActiveAccount({ num });

  const selectItems = deriveInfoItems.map(
    ({ label, value, item: { descI18n, desc, subDesc } }) => {
      let description = desc || subDesc;
      if (descI18n?.id) {
        description = intl.formatMessage({ id: descI18n?.id }, descI18n?.data);
      }
      return {
        label,
        value,
        description,
      };
    },
  );

  const renderTriggerElement = useMemo(() => {
    if (renderTrigger) {
      return renderTrigger;
    }
    if (miniMode) {
      return renderMiniModeTrigger;
    }
    return undefined;
  }, [miniMode, renderTrigger]);

  if (selectedAccount.focusedWallet === '$$others') {
    return null;
  }

  if (!isReady) {
    return null;
  }

  return (
    <>
      {!miniMode ? (
        <SizableText size="$headingXl">
          派生选择器{' '}
          {accountUtils.beautifyPathTemplate({
            template: deriveInfo?.template || '',
          })}
        </SizableText>
      ) : null}

      <Select
        key={`${selectedAccount.deriveType || ''}-${
          selectedAccount.networkId || ''
        }-${deriveInfo?.template || ''}`}
        items={selectItems}
        floatingPanelProps={{
          width: '$78',
        }}
        placement={placement}
        value={selectedAccount.deriveType}
        onChange={(type) =>
          actions.current.updateSelectedAccountDeriveType({
            num,
            deriveType: type as any,
          })
        }
        title="Derivation Path"
        renderTrigger={renderTriggerElement}
      />
    </>
  );
}
