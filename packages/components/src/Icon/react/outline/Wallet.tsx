import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgWallet(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        d="M23.5 26a1 1 0 110 2 1 1 0 010-2"
        stroke="#8C8CA1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.827 7.654l20.194 5.74a6.959 6.959 0 014.786 6.462v19.99a3.788 3.788 0 01-4.8 4.001l-16.705-4.542a6.831 6.831 0 01-4.8-6.382v-21.73A5.081 5.081 0 0111.43 6h25.53a5.539 5.539 0 015.539 5.539v16.53a5.675 5.675 0 01-5.742 5.625h-3.951M42.5 19.847h-9.693"
        stroke="#8C8CA1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgWallet;
