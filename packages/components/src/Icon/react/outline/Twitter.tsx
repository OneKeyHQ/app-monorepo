import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgTwitter(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <Path
        d="M22 3.815a9.91 9.91 0 01-2.855 1.39A4.073 4.073 0 0012 7.934v.91a9.691 9.691 0 01-8.182-4.119S.182 12.906 8.364 16.542A10.581 10.581 0 012 18.36c8.182 4.546 18.182 0 18.182-10.454-.001-.253-.025-.506-.073-.755A7.018 7.018 0 0022 3.815z"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgTwitter;
