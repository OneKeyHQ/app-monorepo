import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Select } from '@onekeyhq/components';

export type MoreViewProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onRefresh: () => void;
  onShare: () => void;
  onCopyUrlToClipboard: () => void;
  onOpenBrowser: () => void;
};

const MoreView: FC<MoreViewProps> = ({
  visible,
  onVisibleChange,
  onRefresh,
  onShare,
  onCopyUrlToClipboard,
  onOpenBrowser,
}) => {
  const intl = useIntl();

  const [currentOptionType, setCurrentOptionType] = useState<string | null>(
    null,
  );

  useEffect(() => {
    function main() {
      switch (currentOptionType) {
        case 'refresh':
          onRefresh();
          setCurrentOptionType(null);
          break;
        case 'share':
          onShare();
          setCurrentOptionType(null);
          break;
        case 'copyUrl':
          onCopyUrlToClipboard();
          setCurrentOptionType(null);
          break;
        case 'openInBrowser':
          onOpenBrowser();
          setCurrentOptionType(null);
          break;
        default:
          break;
      }
    }

    setTimeout(() => main(), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOptionType]);

  return (
    <Select
      visible={visible}
      onVisibleChange={onVisibleChange}
      dropdownPosition="right"
      title={intl.formatMessage({ id: 'select__options' })}
      onChange={(v) => {
        if (currentOptionType !== v) setCurrentOptionType(v);
      }}
      footer={null}
      activatable={false}
      triggerProps={{
        width: '40px',
      }}
      dropdownProps={{
        width: 248,
      }}
      renderTrigger={() => <Box />}
      options={[
        {
          label: intl.formatMessage({
            id: 'action__refresh',
          }),
          value: 'refresh',
          iconProps: { name: 'RefreshOutline' },
        },
        {
          label: intl.formatMessage({
            id: 'action__share',
          }),
          value: 'share',
          iconProps: { name: 'ShareOutline' },
        },
        {
          label: intl.formatMessage({
            id: 'action__copy_url',
          }),
          value: 'copyUrl',
          iconProps: { name: 'LinkOutline' },
        },
        {
          label: intl.formatMessage({
            id: 'action__open_in_browser',
          }),
          value: 'openInBrowser',
          iconProps: { name: 'GlobeAltOutline' },
        },
      ]}
    />
  );
};

export default MoreView;
