import IdentityAssertion from '../../components/IdentityAssertion';

import Explorer from './Explorer';

export default function Discover() {
  return (
    <IdentityAssertion checkCompatibleNetwork={false}>
      <Explorer />
    </IdentityAssertion>
  );
}
