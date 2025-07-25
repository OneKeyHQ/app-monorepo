import { useCallback, useMemo } from 'react';

import {
  Icon,
  Page,
  Spinner,
  Stack,
  Tabs,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { MarketHomeList } from '../components/MarketHomeList';
import { MarketWatchList } from '../components/MarketWatchList';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

// type IAnimatedIconRef = { setIsSelected: (isSelected: boolean) => void };
// function BasicAnimatedIcon(
//   {
//     normalColor,
//     selectedColor,
//   }: {
//     normalColor: IColorTokens;
//     selectedColor: IColorTokens;
//   },
//   ref: ForwardedRef<IAnimatedIconRef>,
// ) {
//   const [color, setColor] = useState(selectedColor);
//   const isSelectedValue = useRef(false);
//   useImperativeHandle(
//     ref,
//     () => ({
//       setIsSelected: (isSelected: boolean) => {
//         isSelectedValue.current = isSelected;
//         setColor(isSelected ? selectedColor : normalColor);
//       },
//     }),
//     [normalColor, selectedColor],
//   );
//   useEffect(() => {
//     if (color !== normalColor && color !== selectedColor) {
//       setColor(isSelectedValue.current ? selectedColor : normalColor);
//     }
//   }, [selectedColor, normalColor, color]);
//   return <Icon name="StarOutline" color={color} size="$4.5" px="$1" />;
// }

// const AnimatedIcon = forwardRef(BasicAnimatedIcon);

function MarketHome() {
  const { result: categories } = usePromiseResult(
    () => backgroundApiProxy.serviceMarket.fetchCategories(),
    [],
    {
      revalidateOnReconnect: true,
    },
  );

  // const { gtMd } = useMedia();

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

  // const ref = useRef<IAnimatedIconRef>(null);
  // const headerProps = useMemo(
  //   () => ({
  //     showHorizontalScrollButton: !gtMd && platformEnv.isRuntimeBrowser,
  //     renderItem: (item: any, index: any, titleStyle: any) =>
  //       index === 0 && !gtMd ? (
  //         <AnimatedIcon
  //           ref={ref}
  //           normalColor={
  //             (titleStyle as { normalColor: IColorTokens })?.normalColor
  //           }
  //           selectedColor={
  //             (titleStyle as { selectedColor: IColorTokens })?.selectedColor
  //           }
  //         />
  //       ) : (
  //         <Tab.SelectedLabel {...titleStyle} />
  //       ),
  //   }),
  //   [gtMd],
  // );

  const { gtMd } = useMedia();
  const handleSelectedPageIndex = useCallback((index: number) => {
    // ref?.current?.setIsSelected?.(index === 0);
    appEventBus.emit(EAppEventBusNames.SwitchMarketHomeTab, {
      tabIndex: index,
    });
  }, []);
  const renderTabContainer = useCallback(() => {
    if (!tabConfig.length) {
      return (
        <Stack flex={1} ai="center" jc="center">
          <Spinner size="large" />
        </Stack>
      );
    }
    return (
      <Tabs.Container
        headerContainerStyle={{
          shadowOpacity: 0,
          elevation: 0,
        }}
        pagerProps={
          {
            offscreenPageLimit: 3,
            scrollSensitivity: 4,
          } as any
        }
        renderTabBar={(props) => (
          <Tabs.TabBar
            {...props}
            scrollable
            renderItem={(
              { name, isFocused, onPress, tabItemStyle, focusedTabStyle },
              index,
            ) =>
              !gtMd && index === 0 ? (
                <YStack
                  ai="center"
                  jc="center"
                  ml="$4"
                  onPress={() => onPress(name)}
                >
                  <Icon
                    name="StarOutline"
                    color={isFocused ? '$text' : '$textSubdued'}
                    size="$4.5"
                    px="$1"
                  />
                  {isFocused ? (
                    <YStack
                      position="absolute"
                      bottom={0}
                      left={0}
                      right={0}
                      h="$0.5"
                      bg="$text"
                      borderRadius={1}
                    />
                  ) : null}
                </YStack>
              ) : (
                <Tabs.TabBarItem
                  name={name}
                  isFocused={isFocused}
                  onPress={onPress}
                  tabItemStyle={tabItemStyle}
                  focusedTabStyle={focusedTabStyle}
                />
              )
            }
          />
        )}
        onIndexChange={handleSelectedPageIndex}
      >
        {tabConfig.map((tab) => (
          <Tabs.Tab key={tab.title} name={tab.title}>
            <Tabs.ScrollView>{tab.page()}</Tabs.ScrollView>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    );
  }, [gtMd, handleSelectedPageIndex, tabConfig]);

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>{renderTabContainer()}</Page.Body>
    </Page>
  );
}

export default function MarketHomeWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketHome />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
