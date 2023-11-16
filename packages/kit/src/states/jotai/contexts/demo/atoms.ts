import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextDemo,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextDemo, contextAtomMethod };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { atom: demoHelloAtom, use: useDemoHelloAtom } =
  contextAtom<string>('hello world');

export interface IDemoJotaiContextProfile {
  name: string;
  id: number;
}

export type IDemoJotaiContextProfilesMap = {
  [key: number]: IDemoJotaiContextProfile;
};

export const { atom: demoProfileAtom, use: useDemoProfileAtom } =
  contextAtom<IDemoJotaiContextProfile>({
    name: 'KK',
    id: 13,
  });

export const { atom: demoProfilesMapAtom, use: useDemoProfilesMapAtom } =
  contextAtom<IDemoJotaiContextProfilesMap>({
    13: {
      name: 'KK',
      id: 13,
    },
    1: {
      name: 'AA',
      id: 1,
    },
    15: {
      name: 'BB',
      id: 15,
    },
  });

export const { atom: demoComputedAtom, use: useDemoComputedAtom } =
  contextAtomComputed<string>((get) => {
    const hello = get(demoHelloAtom());
    const { name, id } = get(demoProfileAtom());
    return `${hello}:  name=${name} id=${id}`;
  });

export function getDemoProfileById({
  id,
  profilesMap,
}: {
  id: number;
  profilesMap: IDemoJotaiContextProfilesMap;
}) {
  return profilesMap[id];
}

export function useDemoProfileById(id: number) {
  const [map] = useDemoProfilesMapAtom();
  return getDemoProfileById({
    id,
    profilesMap: map,
  });
}
