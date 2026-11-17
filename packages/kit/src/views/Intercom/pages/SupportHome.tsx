import { SupportInbox } from '../components/SupportInbox';
import { SupportSessionBoundary } from '../components/SupportSessionBoundary';

export default function SupportHome() {
  return (
    <SupportSessionBoundary>
      {(props) => <SupportInbox {...props} home={true} />}
    </SupportSessionBoundary>
  );
}
