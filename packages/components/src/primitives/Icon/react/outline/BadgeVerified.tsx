import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBadgeVerified = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path d="m15.893 9.504-4.713 6.732-3.591-3.142 1.317-1.505 1.913 1.674 3.435-4.906z" />
      <Path
        fillRule="evenodd"
        d="M15.414 4H20v4.586L23.414 12 20 15.414V20h-4.586L12 23.414 8.586 20H4v-4.586L.586 12 4 8.586V4h4.586L12 .586zm-6 2H6v3.414L3.414 12 6 14.586V18h3.414L12 20.586 14.586 18H18v-3.414L20.586 12 18 9.414V6h-3.414L12 3.414z"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgBadgeVerified;
