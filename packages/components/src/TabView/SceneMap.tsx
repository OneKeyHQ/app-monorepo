import * as React from 'react';

import { FreezeTab } from './FreezeTab';

import type { Route, SceneRendererProps } from './types';
import type { FlatList, ScrollView, SectionList } from 'react-native';

type SceneProps = {
  route: Route;
} & Omit<SceneRendererProps, 'layout'>;

type SceneComponentType =
  | typeof FlatList
  | typeof SectionList
  | typeof ScrollView;

// eslint-disable-next-line react/display-name
const SceneComponent = React.memo(
  <
    T extends {
      component: React.ComponentType<SceneComponentType>;
    } & SceneProps,
  >({
    component,
    ...rest
  }: T) => {
    const { route } = rest;
    return (
      <FreezeTab
        key={route.key}
        route={{
          key: route.key,
          title: route.title,
        }}
        lazy={route.lazy}
        freezeType={route.freezeType}
        autoFreeze={route.autoFreeze}
      >
        {/* @ts-expect-error */}
        {React.createElement(component, rest)}
      </FreezeTab>
    );
  },
);

export function SceneMap(scenes: {
  [key: string]: React.ComponentType<SceneComponentType>;
}) {
  // eslint-disable-next-line react/display-name
  return ({ route, jumpTo, position }: SceneProps) => (
    <SceneComponent
      key={route.key}
      jumpTo={jumpTo}
      position={position}
      route={route}
      component={scenes[route.key]}
    />
  );
}
