import React, {
  ComponentProps,
  FC,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, IconButton, Input } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components';

import { SearchView } from '../Search/SearchView';

import type { ExplorerViewProps } from '..';

type BrowserURLInputProps = {
  onClear?: () => void;
  onChangeText?: (text: string) => void;
  customLeftIcon?: ICON_NAMES;
} & Omit<ComponentProps<typeof Input>, 'onChange' | 'onChangeText'>;

const BrowserURLInput = React.forwardRef<typeof Input, BrowserURLInputProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onClear, onChangeText, customLeftIcon, ...props }, ref) => {
    const [innerValue, setInnerValue] = useState(value);
    const handleChangeText = useCallback(
      (text: string) => {
        if (typeof value === 'undefined') {
          setInnerValue(text);
        } else if (typeof onChangeText !== 'undefined') {
          onChangeText(text);
        }
      },
      [value, onChangeText],
    );

    return (
      <Input
        // @ts-expect-error
        ref={ref}
        value={value ?? innerValue}
        leftIconName={customLeftIcon ?? 'SearchOutline'}
        // rightIconName={rightIconName}
        placeholder="Search..."
        onPressRightIcon={onClear}
        onChangeText={handleChangeText}
        {...props}
      />
    );
  },
);

BrowserURLInput.displayName = 'BrowserURLInput';

const Desktop: FC<ExplorerViewProps> = ({
  searchContent,
  onSearchContentChange,
  onSearchSubmitEditing,
  explorerContent,
  canGoBack,
  canGoForward,
  onGoBack,
  onNext,
  onRefresh,
  moreView,
  showExplorerBar,
}) => {
  const intl = useIntl();

  const [historyVisible, setHistoryVisible] = React.useState(false);
  const searchBar = useRef<any>(null);

  return (
    <Box flex="1" zIndex={3}>
      {!!showExplorerBar && (
        <Box bg="surface-subdued" zIndex={5}>
          <HStack
            w="100%"
            h="64px"
            px={8}
            space={3}
            flexDirection="row"
            alignItems="center"
          >
            <IconButton
              type="plain"
              name="ArrowLeftOutline"
              disabled={!canGoBack}
              onPress={onGoBack}
            />
            <IconButton
              type="plain"
              name="ArrowRightOutline"
              disabled={!canGoForward}
              onPress={onNext}
            />
            <IconButton
              type="plain"
              name="RefreshOutline"
              onPress={onRefresh}
            />

            <BrowserURLInput
              ref={searchBar}
              flex={1}
              h="38px"
              placeholder={intl.formatMessage({
                id: 'content__search_or_enter_dapp_url',
              })}
              customLeftIcon="LockClosedSolid"
              size="base"
              value={searchContent}
              onClear={() => onSearchContentChange?.('')}
              onChangeText={onSearchContentChange}
              onSubmitEditing={(event) => {
                onSearchContentChange?.(event.nativeEvent.text);
                onSearchSubmitEditing?.(event.nativeEvent.text);
              }}
              onFocus={() => {
                setHistoryVisible(true);
                console.log('onFocus');
              }}
              onBlur={() => {
                setHistoryVisible(false);
                console.log('onBlur');
              }}
            />

            {/* <IconButton
            type="plain"
            name="DotsHorizontalOutline"
            onPress={onMore}
          /> */}
          </HStack>
          {moreView}
          <SearchView
            visible={historyVisible}
            onVisibleChange={setHistoryVisible}
            searchContent={searchContent ?? ''}
            onSelectorItem={(item) => {
              onSearchSubmitEditing?.(item);
            }}
            relativeComponent={searchBar.current}
          />
        </Box>
      )}

      <Box flex={1} zIndex={3}>
        {explorerContent}
      </Box>
    </Box>
  );
};

export default Desktop;
