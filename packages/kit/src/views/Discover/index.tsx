// import React from 'react';

import IdentityAssertion from '../../components/IdentityAssertion';

import Explorer from './Explorer';

export default function Discover() {
  return (
    <IdentityAssertion>
      <Explorer />
    </IdentityAssertion>
  );
}
