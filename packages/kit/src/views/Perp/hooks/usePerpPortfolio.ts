import {
  useOpenOrdersListAtom,
  usePositionListAtom,
} from '../../../states/jotai/contexts/hyperliquid';

export function usePerpPositions() {
  const [positions] = usePositionListAtom();
  return positions;
}

export function usePerpOrders() {
  const [orders] = useOpenOrdersListAtom();
  return orders;
}
