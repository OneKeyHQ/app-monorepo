import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  demoComputedAtom,
  demoProfileAtom,
  demoProfilesMapAtom,
  getDemoProfileById,
} from './atoms';

import type {
  IDemoJotaiContextProfile,
  IDemoJotaiContextProfilesMap,
} from './atoms';

class ContextJotaiActionsDemo extends ContextJotaiActionsBase {
  getDemoProfileById = contextAtomMethod((get, set, id: number) => {
    const map = get(demoProfilesMapAtom());
    return getDemoProfileById({
      id,
      profilesMap: map,
    });
  });

  updateProfile = contextAtomMethod(
    (get, set, profile: IDemoJotaiContextProfile) => {
      const map = get(demoProfilesMapAtom());
      const newMap: IDemoJotaiContextProfilesMap = {
        ...map,
      };
      newMap[profile.id] = profile;
      set(demoProfilesMapAtom(), newMap);
      set(demoProfileAtom(), profile);
    },
  );

  sayHello = contextAtomMethod(async (get, set, message: string) => {
    const profile = get(demoProfileAtom());
    const message2 = get(demoComputedAtom());
    console.log('sayHello', message, message2, profile);
    await wait(1000);
    set(demoProfileAtom(), { ...profile, name: 'LazyUpdate' });
    this.updateProfile.call(set, profile);
    return message;
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsDemo()', Date.now());
  return new ContextJotaiActionsDemo();
});

export function useDemoJotaiActions() {
  const actions = createActions();
  const updateProfile = actions.updateProfile.use();
  const sayHello = actions.sayHello.use();

  return {
    updateProfile,
    sayHello,
  };
}
