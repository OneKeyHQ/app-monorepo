import * as React from 'react';
import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';

function SvgBellOff(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="none" {...props}>
      <G clipPath="url(#bell-off_svg__clip0_904_18483)" fill="#8C8CA1">
        <Path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        <Path d="M3.707 2.293a1 1 0 00-1.414 1.414l6.921 6.922c.05.062.105.118.168.167l6.91 6.911a1 1 0 001.415-1.414l-.675-.675L3.707 2.293z" />
      </G>
      <Defs>
        <ClipPath id="bell-off_svg__clip0_904_18483">
          <Path fill="#fff" d="M0 0h20v20H0z" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

export default SvgBellOff;
