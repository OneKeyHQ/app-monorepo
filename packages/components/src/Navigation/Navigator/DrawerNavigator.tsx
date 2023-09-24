import { createDrawerNavigator } from '@react-navigation/drawer';

import type { CommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

type DrawerNavigatorConfig<P extends ParamListBase> = CommonNavigatorConfig<P>;

interface DrawerNavigatorProps<P extends ParamListBase> {
  config: DrawerNavigatorConfig<P>[];
}

export function createDrawerNavigatorConfig<P extends ParamListBase>(
  config: DrawerNavigatorConfig<P>[],
): DrawerNavigatorConfig<P>[] {
  return config;
}

export function DrawerNavigator<P extends ParamListBase>({
  config,
}: DrawerNavigatorProps<P>) {
  const DrawerStack = createDrawerNavigator<P>();

  return (
    <DrawerStack.Navigator>
      {config.map(({ name, component, options }) => (
        <DrawerStack.Screen
          key={name}
          name={name}
          component={component}
          options={options}
        />
      ))}
    </DrawerStack.Navigator>
  );
}
