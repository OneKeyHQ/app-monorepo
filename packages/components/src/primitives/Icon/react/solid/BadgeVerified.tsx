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
      <Path
        fillRule="evenodd"
        d="M8.586 4 12 .586 15.414 4H20v4.586L23.414 12 20 15.414V20h-4.586L12 23.414 8.586 20H4v-4.586L.586 12 4 8.586V4zm7.307 5.504-1.639-1.147-3.434 4.907-1.914-1.675-1.317 1.505 3.591 3.142z"
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
