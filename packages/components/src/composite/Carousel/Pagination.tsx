import { type StyleProp, View, type ViewStyle } from 'react-native';

import { PaginationItem } from './PaginationItem';

import type { IDotStyle } from './PaginationItem';
import type { SharedValue } from 'react-native-reanimated';

export interface IPaginationProps<T> {
  progress: SharedValue<number>;
  horizontal?: boolean;
  data: Array<T>;
  renderItem?: (item: T, index: number) => React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  dotStyle?: IDotStyle;
  activeDotStyle?: IDotStyle;
  size?: number;
  onPress?: (index: number) => void;
}

export const Pagination = <T extends object>(props: IPaginationProps<T>) => {
  const {
    activeDotStyle,
    dotStyle,
    progress,
    horizontal = true,
    data,
    size,
    containerStyle,
    renderItem,
    onPress,
  } = props;

  if (
    typeof size === 'string' ||
    typeof dotStyle?.width === 'string' ||
    typeof dotStyle?.height === 'string'
  ) {
    // eslint-disable-next-line no-restricted-syntax
    console.error('size/width/height must be a number');
    return null;
  }

  return (
    <View
      style={[
        {
          justifyContent: 'space-between',
          alignSelf: 'center',
        },
        horizontal
          ? {
              flexDirection: 'row',
            }
          : {
              flexDirection: 'column',
            },
        containerStyle,
      ]}
    >
      {data.map((item, index) => {
        return (
          <PaginationItem
            key={index}
            index={index}
            size={size}
            count={data.length}
            dotStyle={dotStyle}
            animValue={progress}
            horizontal={!horizontal}
            activeDotStyle={activeDotStyle}
            onPress={() => onPress?.(index)}
          >
            {renderItem?.(item, index)}
          </PaginationItem>
        );
      })}
    </View>
  );
};
