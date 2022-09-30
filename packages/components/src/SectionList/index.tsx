import type { ISectionListProps } from 'native-base/lib/typescript/components/basic/SectionList/types';

export { SectionList as default } from 'native-base';

// TODO need update native-base to >= 3.4 to use generic type on ISectionListProps
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type SectionListProps<T = unknown> = ISectionListProps;
