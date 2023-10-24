import { useActiveTabContext } from '../Provider/ActiveTabContext';

export default function useIsActiveTab(tabName: string) {
  const { activeTabKey } = useActiveTabContext();
  return activeTabKey === tabName;
}
