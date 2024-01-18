import { Stack } from '@onekeyhq/components';

import { Banner } from './Banner';
import { BookmarksAndHistoriesSection } from './BookmarksAndHistoriesSection';
import { SuggestedAndExploreSection } from './SuggestedAndExploreSection';

export function DashboardContent() {
  return (
    <Stack>
      <Banner />
      <BookmarksAndHistoriesSection />
      <SuggestedAndExploreSection />
    </Stack>
  );
}
