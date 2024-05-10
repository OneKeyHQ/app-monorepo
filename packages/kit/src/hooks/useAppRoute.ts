import { useRoute } from '@react-navigation/core';

import type { ParamListBase, RouteProp } from '@react-navigation/core';

export function useAppRoute<
  TParamsList extends ParamListBase,
  TRoutes extends string,
>() {
  return useRoute<RouteProp<TParamsList, TRoutes>>();
}
