// import { createLazyComponent } from '@onekeyhq/kit/src/utils/createLazyComponent';

// const Main = createLazyComponent(
//   () => import('@onekeyhq/kit/src/routes/Root/Main'),
// );

import { Link } from 'expo-router';

import { Box } from '@onekeyhq/components';
// import { useOnboardingRequired } from '@onekeyhq/kit/src/hooks/useOnboardingRequired';

export default function RootPage() {
  // useOnboardingRequired(true)

  return (
    <Box flex={1} alignItems="center" justifyContent="center">
      <Link href="/onboarding/welcome">Welcome</Link>
      <Link href="/drawer">Drawer</Link>
    </Box>
  );
}
