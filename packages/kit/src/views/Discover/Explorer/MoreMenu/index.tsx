import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Select, useToast } from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useWebTab } from '../Controller/useWebTabs';

export type MoreViewProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onRefresh: () => void;
  onShare: () => void;
  onCopyUrlToClipboard: () => void;
  onOpenBrowser: () => void;
  onGoHomePage: () => void;
};

const MoreView: FC<MoreViewProps> = ({
  visible,
  onVisibleChange,
  onRefresh,
  onShare,
  onCopyUrlToClipboard,
  onOpenBrowser,
  onGoHomePage,
}) => {
  const intl = useIntl();
  const toast = useToast();

  const [currentOptionType, setCurrentOptionType] = useState<string | null>(
    null,
  );

  const currentTab = useWebTab();

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
        case 'goHome':
          onGoHomePage();
          setCurrentOptionType(null);
          break;
        case 'unfavorites':
          if (currentTab) {
            backgroundApiProxy.serviceDiscover.removeBookmark(currentTab);
          }
          toast.show({ title: intl.formatMessage({ id: 'msg__success' }) });
          break;
        case 'favorites':
          if (currentTab) {
            backgroundApiProxy.serviceDiscover.addBookmark(currentTab);
          }
          toast.show({ title: intl.formatMessage({ id: 'msg__success' }) });
          break;
        default:
          break;
      }
    }

    setTimeout(() => main(), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOptionType]);

  const options: SelectItem<string>[] = [
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
      label: currentTab?.isBookmarked
        ? intl.formatMessage({
            id: 'action__remove_from_favorites',
          })
        : intl.formatMessage({
            id: 'action__add_to_favorites',
          }),
      value: currentTab?.isBookmarked ? 'unfavorites' : 'favorites',
      iconProps: { name: 'StarSolid' },
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
    {
      label: intl.formatMessage({
        id: 'action__back_to_home_page',
      }),
      value: 'goHome',
      iconProps: { name: 'HomeOutline' },
    },
  ];

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
      options={options}
    />
  );
};

export default MoreView;
