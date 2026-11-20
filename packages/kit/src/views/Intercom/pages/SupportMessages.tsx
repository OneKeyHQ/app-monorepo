import { SupportInbox } from '../components/SupportInbox';
import { SupportSessionBoundary } from '../components/SupportSessionBoundary';

export default function SupportMessages() {
  return (
    <SupportSessionBoundary>
      {(props) => <SupportInbox {...props} home={false} />}
    </SupportSessionBoundary>
  );
}
