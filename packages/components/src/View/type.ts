import type { PropsWithChildren } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export type IViewType = PropsWithChildren<{ style?: StyleProp<ViewStyle> }>;
