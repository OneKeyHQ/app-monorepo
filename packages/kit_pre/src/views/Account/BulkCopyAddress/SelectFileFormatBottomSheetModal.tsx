import { useState } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Button,
  SegmentedControl,
  VStack,
} from '@onekeyhq/components';
import { formatMessage } from '@onekeyhq/components/src/Provider';

import { showOverlay } from '../../../utils/overlayUtils';

const Content: FC<{ onSelect: (type: 'csv' | 'txt') => void }> = ({
  onSelect,
}) => {
  const intl = useIntl();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  return (
    <VStack space={8}>
      <SegmentedControl
        values={['CSV', 'TXT']}
        selectedIndex={selectedIndex}
        onChange={setSelectedIndex}
      />
      <Button
        type="primary"
        size="xl"
        onPress={() => {
          onSelect(selectedIndex === 0 ? 'csv' : 'txt');
        }}
      >
        {intl.formatMessage({ id: 'action__export' })}
      </Button>
    </VStack>
  );
};

const showFileFormatBottomSheetModal = ({
  onSelect,
}: {
  onSelect: (type: 'csv' | 'txt') => void;
}) => {
  showOverlay((close) => (
    <BottomSheetModal
      title={formatMessage({
        id: 'title__select_file_format',
      })}
      closeOverlay={close}
      modalLizeProps={{
        tapGestureEnabled: false,
      }}
    >
      <Content
        onSelect={(type: 'csv' | 'txt') => {
          close?.();
          setTimeout(() => onSelect?.(type));
        }}
      />
    </BottomSheetModal>
  ));
};

export default showFileFormatBottomSheetModal;
