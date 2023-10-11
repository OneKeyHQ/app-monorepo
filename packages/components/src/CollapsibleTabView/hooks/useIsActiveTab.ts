import { useActiveTab } from '../ActiveTabContext';

export default function useIsActiveTab(tabName: string) {
  const { activeTabName } = useActiveTab();
  return activeTabName === tabName;
}
