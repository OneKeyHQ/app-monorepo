import { Stack } from '@onekeyhq/components';

import { Banner } from './Banner';
import { BookmarksAndHistoriesSection } from './BookmarksAndHistoriesSection';

export function DashboardContent() {
  return (
    <Stack>
      <Banner />
      <BookmarksAndHistoriesSection />
    </Stack>
  );
}
