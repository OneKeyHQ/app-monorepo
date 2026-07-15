import { type MessageDescriptor, defineMessages } from 'react-intl';

type IPendingMessageDescriptor = Omit<MessageDescriptor, 'id'> & {
  id: string;
};

// Keep PR copy usable while the matching Lokalise keys are pending in the
// current project. The default message prevents raw IDs from reaching users.
export function definePendingMessages<
  const T extends Record<string, IPendingMessageDescriptor>,
>(messages: T): { [K in keyof T]: MessageDescriptor } {
  return defineMessages(
    messages as unknown as { [K in keyof T]: MessageDescriptor },
  );
}
