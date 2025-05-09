import { YStack } from '@onekeyhq/components';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';

import { Layout } from './utils/Layout';

const CountDownCalendarAlertGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="CountDownCalendarAlert"
    description="The CountDownCalendarAlert component is used to display calendar-based countdown reminders, helping users understand the remaining time for important events or deadlines. It provides an intuitive way to display time, suitable for event announcements, promotional countdowns, and similar scenarios."
    suggestions={[
      'Use countdown reminders before important dates or events',
      'Ensure the target time for the countdown is set accurately',
      'Can be combined with other visual elements to enhance user perception of time',
    ]}
    elements={[
      {
        title: 'State',
        element: (
          <YStack gap="$4">
            <CountDownCalendarAlert
              effectiveTimeAt={Date.now() - 1000 * 60 * 60 * 24}
            />
            <CountDownCalendarAlert effectiveTimeAt={Date.now() - 1000 * 60} />
            <CountDownCalendarAlert effectiveTimeAt={Date.now()} />
            <CountDownCalendarAlert effectiveTimeAt={Date.now() + 2000 * 60} />
            <CountDownCalendarAlert effectiveTimeAt={2_060_353_610_000} />
          </YStack>
        ),
      },
    ]}
  />
);

export default CountDownCalendarAlertGallery;
