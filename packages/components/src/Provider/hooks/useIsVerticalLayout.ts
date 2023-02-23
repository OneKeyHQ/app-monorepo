import useUserDevice from './useUserDevice';

export default function useIsVerticalLayout() {
  const { size } = useUserDevice();
  return size === 'SMALL';
}
