import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Icon, Page, Tab, useMedia } from '@onekeyhq/components';
import type { IColorTokens } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketCategory } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeHeader as MDMarketHomeHeader } from './components/MarketHomeHeader.md';
import { MarketHomeList } from './components/MarketHomeList';
import { MarketWatchList } from './components/MarketWatchList';
import { MarketWatchListProviderMirror } from './MarketWatchListProviderMirror';

type IAnimatedIconRef = { setIsSelected: (isSelected: boolean) => void };
function BasicAnimatedIcon(
  {
    normalColor,
    selectedColor,
  }: {
    normalColor: IColorTokens;
    selectedColor: IColorTokens;
  },
  ref: ForwardedRef<IAnimatedIconRef>,
) {
  const [color, setColor] = useState(selectedColor);
  const isSelectedValue = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      setIsSelected: (isSelected: boolean) => {
        isSelectedValue.current = isSelected;
        setColor(isSelected ? selectedColor : normalColor);
      },
    }),
    [normalColor, selectedColor],
  );
  useEffect(() => {
    if (color !== normalColor && color !== selectedColor) {
      setColor(isSelectedValue.current ? selectedColor : normalColor);
    }
  }, [selectedColor, normalColor, color]);
  return <Icon name="StarOutline" color={color} size="$4.5" px="$1" />;
}

const AnimatedIcon = forwardRef(BasicAnimatedIcon);

function MarketHome() {
  const [categories, setCategories] = useState<IMarketCategory[]>([]);
  useEffect(() => {
    void backgroundApiProxy.serviceMarket.fetchCategories().then((response) => {
      setCategories(response);
    });
  }, []);

  const { gtMd } = useMedia();

  const tabConfig = useMemo(
    () =>
      categories?.map((category, index) => ({
        title: category.name,
        // eslint-disable-next-line react/no-unstable-nested-components
        page: () =>
          index === 0 ? (
            <MarketWatchList category={category} />
          ) : (
            <MarketHomeList category={category} tabIndex={index} />
          ),
      })) || [],
    [categories],
  );

  const ref = useRef<IAnimatedIconRef>(null);
  return (
    <Page>
      {gtMd ? <MarketHomeHeader /> : <MDMarketHomeHeader />}
      <Page.Body>
        <Tab.Page
          data={tabConfig}
          headerProps={{
            contentContainerStyle: { paddingRight: '$5' },
            showHorizontalScrollButton: !gtMd && platformEnv.isRuntimeBrowser,
            renderItem: (item, index, titleStyle) =>
              index === 0 && !gtMd ? (
                <AnimatedIcon
                  ref={ref}
                  normalColor={
                    (titleStyle as { normalColor: IColorTokens })?.normalColor
                  }
                  selectedColor={
                    (titleStyle as { selectedColor: IColorTokens })
                      ?.selectedColor
                  }
                />
              ) : (
                <Tab.SelectedLabel {...(titleStyle as any)} />
              ),
          }}
          onSelectedPageIndex={(index: number) => {
            ref?.current?.setIsSelected?.(index === 0);
            appEventBus.emit(EAppEventBusNames.SwitchMarketHomeTab, {
              tabIndex: index,
            });
            console.log('选中', index, index === 0 ? 1 : 0);
          }}
          windowSize={15}
        />
      </Page.Body>
    </Page>
  );
}

export default function MarketHomeWithProvider() {
  return (
    <MarketWatchListProviderMirror
      storeName={EJotaiContextStoreNames.marketWatchList}
    >
      <MarketHome />
    </MarketWatchListProviderMirror>
  );
}
