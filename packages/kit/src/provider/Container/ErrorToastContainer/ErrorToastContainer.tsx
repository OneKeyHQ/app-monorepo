import { ErrorToastListener } from './ErrorToastListener';
import { getErrorAction } from './ErrorToasts';

export function ErrorToastContainer() {
  return <ErrorToastListener getActions={getErrorAction} />;
}
