import { Page } from '@onekeyhq/components';

import { NotificationListView } from '../components/NotificationListView';

function NotificationList() {
  return (
    <Page safeAreaEnabled={false}>
      <Page.Body>
        <NotificationListView />
      </Page.Body>
    </Page>
  );
}

export default NotificationList;
