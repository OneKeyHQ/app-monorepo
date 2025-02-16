import { useCallback, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { DataViewerTab } from '../SignatureConfirmDataViewer';

import { AdvancedSettings } from './AdvancedSettings';

type IProps = {
  unsignedMessage: IUnsignedMessage;
};

function MessageAdvancedSettings(props: IProps) {
  const { unsignedMessage } = props;

  const rawMessage = useMemo(() => {
    const { message, type } = unsignedMessage;
    let text = message;

    if (
      type === EMessageTypesEth.TYPED_DATA_V1 ||
      type === EMessageTypesEth.TYPED_DATA_V3 ||
      type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      try {
        text = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse typed data message: ', e);
      }
      text = JSON.stringify(text, null, 2);
    }
    return text;
  }, [unsignedMessage]);

  const renderAdvancedSettings = useCallback(
    () => (
      <YStack gap="$5">
        <DataViewerTab
          dataGroup={[{ title: 'DATA', data: rawMessage ?? '' }]}
          showCopy
        />
      </YStack>
    ),
    [rawMessage],
  );

  return <AdvancedSettings>{renderAdvancedSettings()}</AdvancedSettings>;
}

export { MessageAdvancedSettings };
