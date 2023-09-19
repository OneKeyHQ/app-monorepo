import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgRipple = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <G fill="#8C8CA1" clipPath="url(#a)">
      <Path d="M10.828 4.484h1.156L9.578 6.867a2.249 2.249 0 0 1-3.156 0L4.015 4.484h1.157L7 6.294a1.424 1.424 0 0 0 1.999 0l1.83-1.81ZM5.157 11.11H4l2.422-2.398a2.249 2.249 0 0 1 3.156 0L12 11.11h-1.156L9 9.285a1.424 1.424 0 0 0-1.999 0l-1.844 1.824Z" />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M4 4.484h8v6.625H4z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgRipple;
