import React, {
  CSSProperties,
  Children,
  ComponentProps,
  FC,
  ReactElement,
  ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react';

import MaterialTab from '@mui/material/Tab';
import MaterialTabs from '@mui/material/Tabs';
import { StyleProp, ViewStyle } from 'react-native';
import { Container as BaseContainer } from 'react-native-collapsible-tab-view';
import { useDeepCompareMemo } from 'use-deep-compare';

import Box from '../Box';
import FlatList from '../FlatList';
import { useIsVerticalLayout } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

type TabProps = {
  name: string;
  // eslint-disable-next-line react/no-unused-prop-types
  label?: string;
};

type MaterialTabsProps = {
  value: string;
  handleChange: (event: React.SyntheticEvent, value: any) => void;
  names: string[];
  options: Map<string, { index: number } & TabProps>;
  activeColor?: string;
  inactiveColor?: string;
  labelStyle?: CSSProperties;
  indicatorStyle?: CSSProperties;
};

export function useTabProps(
  children: ReactElement<{ children: ReactNode } & TabProps>,
  tabType: FC<TabProps>,
) {
  const options = useMemo(() => {
    const tabOptions = new Map<string, { index: number } & TabProps>();

    if (children) {
      Children.forEach(children, (element, index) => {
        if (!element) return;
        if (element.type !== tabType)
          throw new Error(
            'Container children must be wrapped in a <Tabs.Tab ... /> component',
          );

        // eslint-disable-next-line @typescript-eslint/no-shadow
        const { name, children, ...options } = element.props;
        if (tabOptions.has(name))
          throw new Error(
            'Tab names must be unique, '.concat(name, ' already exists'),
          );
        tabOptions.set(name, {
          index,
          name,
          ...options,
        });
      });
    }

    return tabOptions;
  }, [children, tabType]);
  const optionEntries = Array.from(options.entries());
  const optionKeys = Array.from(options.keys());
  const memoizedOptions = useDeepCompareMemo(() => options, [optionEntries]);
  const memoizedTabNames = useDeepCompareMemo(() => optionKeys, [optionKeys]);
  return { options: memoizedOptions, names: memoizedTabNames };
}

const Context = createContext<string>('');

const Tab: FC<TabProps> = ({ children, name }) => {
  const activeTab = useContext(Context);
  const isHidden = activeTab !== name;
  return <Box display={isHidden ? 'none' : 'block'}>{children}</Box>;
};

const Container: FC<ComponentProps<typeof BaseContainer>> = ({
  children,
  containerStyle,
  headerHeight,
  renderHeader,
  headerContainerStyle,
  renderTabBar,
}) => {
  const { options, names } = useTabProps(children as any, Tab);

  const [value, setValue] = React.useState(names[0]);
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  return (
    <Box flex="1" overflow="scroll">
      <Box flex="1" style={containerStyle} w="100%">
        <Box
          h={headerHeight ? headerHeight + 48 : 'auto'}
          position="relative"
          style={[headerContainerStyle as StyleProp<ViewStyle>]}
        >
          {renderHeader?.({} as any)}
          <Box position="absolute" bottom={0} left={0} right={0}>
            {renderTabBar?.({ value, handleChange, options, names } as any)}
          </Box>
        </Box>
        <Context.Provider value={value}>{children}</Context.Provider>
      </Box>
    </Box>
  );
};

export const MaterialTabBar: FC<MaterialTabsProps> = ({
  value,
  handleChange,
  names,
  options,
  activeColor,
  inactiveColor,
  labelStyle,
  indicatorStyle,
}) => {
  const tabItems = useMemo(
    () =>
      names.map((tabName) => (
        <MaterialTab
          key={tabName}
          style={{
            color: value === tabName ? activeColor : inactiveColor,
            fontWeight: labelStyle?.fontWeight,
            fontSize: labelStyle?.fontSize,
            fontFamily: labelStyle?.fontFamily,
          }}
          disableRipple
          label={
            options?.get?.(tabName)?.label ?? options?.get?.(tabName)?.name
          }
          value={options?.get?.(tabName)?.name}
        />
      )),
    [value, activeColor, inactiveColor, labelStyle, options, names],
  );
  return (
    <MaterialTabs
      onChange={handleChange}
      value={value}
      TabIndicatorProps={{
        style: indicatorStyle,
      }}
      variant={useIsVerticalLayout() ? 'fullWidth' : 'standard'}
      scrollButtons={false}
    >
      {tabItems}
    </MaterialTabs>
  );
};

export const Tabs = {
  Container,
  Tab,
  FlatList,
  ScrollView,
  SectionList,
};
