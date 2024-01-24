import { IconButton, Select, SizableText } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { useDeriveTypeAutoSelect } from './hooks/useDeriveTypeAutoSelect';

export function DeriveTypeSelectorTrigger({
  num,
  miniMode,
}: {
  num: number;
  miniMode?: boolean;
}) {
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  const { deriveInfoItems, currentDeriveInfo } = useDeriveTypeAutoSelect({
    num,
  });

  if (!isReady) {
    return null;
  }

  return (
    <>
      {!miniMode ? (
        <SizableText size="$headingXl">
          派生选择器{' '}
          {accountUtils.beautifyPathTemplate({
            template: currentDeriveInfo?.item?.template || '',
          })}
        </SizableText>
      ) : null}

      <Select
        key={`${selectedAccount.deriveType || ''}-${
          selectedAccount.networkId || ''
        }`}
        items={deriveInfoItems}
        value={selectedAccount.deriveType}
        onChange={(type) =>
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              deriveType: type as any,
            }),
          })
        }
        title="派生类型"
        renderTrigger={
          miniMode
            ? () => (
                <IconButton
                  title="派生类型"
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
              )
            : undefined
        }
      />
    </>
  );
}
