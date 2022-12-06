import { FC, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Select } from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import { Toast } from '@onekeyhq/components/src/Toast/useToast';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { homeTab, setWebTabData } from '../../../../store/reducers/webTabs';
import { openUrlExternal } from '../../../../utils/openUrl';
import { showOverlay } from '../../../../utils/overlayUtils';
import { useWebController } from '../Controller/useWebController';

const MoreMenu: FC<{ onClose: () => void }> = ({ onClose }) => {
  const intl = useIntl();

  const isProcessing = useRef(false);
  const { currentTab, stopLoading, reload } = useWebController();
  const getCurrentUrl = () => currentTab?.url ?? '';
  const options = [
    {
      label: intl.formatMessage({
        id: 'action__refresh',
      }),
      value: reload,
      iconProps: { name: 'ArrowPathOutline' },
    },
    {
      label: intl.formatMessage({
        id: 'action__share',
      }),
      value: () => {
        setTimeout(() => {
          Share.share(
            Platform.OS === 'ios'
              ? {
                  url: getCurrentUrl(),
                }
              : {
                  message: getCurrentUrl(),
                },
          ).catch();
        }, 100);
      },
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
      value: () => {
        if (!currentTab) return;
        if (currentTab.isBookmarked) {
          backgroundApiProxy.serviceDiscover.removeFavorite(currentTab.url);
        } else {
          backgroundApiProxy.serviceDiscover.addFavorite(currentTab.url);
        }
        Toast.show({ title: intl.formatMessage({ id: 'msg__success' }) });
      },
      iconProps: { name: 'StarOutline' },
    },
    {
      label: intl.formatMessage({
        id: 'action__copy_url',
      }),
      value: () => {
        copyToClipboard(getCurrentUrl());
        Toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
      },
      iconProps: { name: 'LinkOutline' },
    },
    {
      label: intl.formatMessage({
        id: 'action__open_in_browser',
      }),
      value: () => openUrlExternal(getCurrentUrl()),
      iconProps: { name: 'GlobeAltOutline' },
    },
    {
      label: intl.formatMessage({
        id: 'action__back_to_home_page',
      }),
      value: () => {
        stopLoading();
        backgroundApiProxy.dispatch(
          setWebTabData({ ...homeTab, id: currentTab.id }),
        );
      },
      iconProps: { name: 'HomeOutline' },
    },
  ].map((item) => ({
    ...item,
    value: () => {
      if (isProcessing.current) return;
      isProcessing.current = true;
      item.value();
      isProcessing.current = false;
    },
  })) as SelectItem<() => void>[];

  return (
    <Select
      visible
      dropdownPosition="right"
      title={intl.formatMessage({ id: 'select__options' })}
      onVisibleChange={onClose}
      footer={null}
      activatable={false}
      triggerProps={{
        width: '40px',
      }}
      dropdownProps={{
        width: 248,
      }}
      options={options}
    />
  );
};

export const showWebMoreMenu = () =>
  showOverlay((onClose) => <MoreMenu onClose={onClose} />);
