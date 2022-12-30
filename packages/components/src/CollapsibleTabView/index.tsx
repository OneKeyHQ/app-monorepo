import type { CSSProperties, FC, ReactNode, SyntheticEvent } from 'react';
import { Children, createContext, useContext, useMemo, useState } from 'react';

import MaterialTab from '@mui/material/Tab';
import MaterialTabs from '@mui/material/Tabs';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';

import Box from '../Box';
import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

import type { CollapsibleContainerProps } from './types';

type TabProps = {
  name: string;
  label?: string;
};

type MaterialTabsProps = {
  value: string;
  handleChange: (event: SyntheticEvent, value: any) => void;
  names: string[];
  options: Map<string, { index: number } & TabProps>;
  activeColor?: string;
  inactiveColor?: string;
  labelStyle?: CSSProperties;
  indicatorStyle?: CSSProperties;
};

export function useTabProps(children: ReactNode) {
  const options = useMemo(() => {
    const tabOptions = new Map<string, { index: number } & TabProps>();

    if (children) {
      Children.forEach(children, (element, index) => {
        // @ts-ignore
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
  }, [children]);
  const optionKeys = Array.from(options.keys());
  return { options, names: optionKeys };
}

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

const Context = createContext<string>('');

const Tab: FC<TabProps> = ({ children, name }) => {
  const activeTab = useContext(Context);
  const isHidden = activeTab !== name;
  return <Box display={isHidden ? 'none' : 'block'}>{children}</Box>;
};

const Container: FC<CollapsibleContainerProps> = ({
  children,
  containerStyle,
  headerHeight,
  renderHeader,
  headerContainerStyle,
  onTabChange,
  onIndexChange,
  initialTabName,
}) => {
  const { options, names } = useTabProps(children);

  const [value, setValue] = useState(initialTabName || names[0]);
  const handleChange = (event: SyntheticEvent, newValue: string) => {
    setValue(newValue);
    const index = names.findIndex((item) => item === newValue);

    if (onTabChange) {
      onTabChange({
        index,
        tabName: newValue,
      });
    }
    if (onIndexChange) {
      onIndexChange(index);
    }
  };
  const [activeLabelColor, labelColor, indicatorColor] = useThemeValue([
    'text-default',
    'text-subdued',
    'action-primary-default',
  ]);

  return (
    <ScrollView style={containerStyle}>
      <Box
        h={headerHeight ? headerHeight + 48 : 'auto'}
        position="relative"
        style={headerContainerStyle}
      >
        {renderHeader?.()}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <MaterialTabBar
            value={value}
            activeColor={activeLabelColor}
            inactiveColor={labelColor}
            labelStyle={{
              fontFamily: 'BlinkMacSystemFont',
            }}
            indicatorStyle={{ backgroundColor: indicatorColor }}
            handleChange={handleChange}
            options={options}
            names={names}
          />
        </Box>
      </Box>
      <Context.Provider value={value}>{children}</Context.Provider>
    </ScrollView>
  );
};

export const Tabs = {
  Container,
  Tab,
  FlatList,
  ScrollView,
  SectionList,
};

export * from './types';
