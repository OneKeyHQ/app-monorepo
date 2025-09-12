import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTarget = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 2a1 1 0 1 0-2 0v2.566a7.6 7.6 0 0 1 2 0zM2 11h2.566a7.6 7.6 0 0 0 0 2H2a1 1 0 1 1 0-2m9 8.434V22a1 1 0 1 0 2 0v-2.566a7.6 7.6 0 0 1-2 0V16a1 1 0 1 1 2 0v3.434A7.504 7.504 0 0 0 19.434 13H16a1 1 0 1 1 0-2h3.434a7.6 7.6 0 0 1 0 2H22a1 1 0 1 0 0-2h-2.566A7.505 7.505 0 0 0 13 4.566V8a1 1 0 1 1-2 0V4.566A7.504 7.504 0 0 0 4.566 11H8a1 1 0 1 1 0 2H4.566A7.505 7.505 0 0 0 11 19.434"
    />
  </Svg>
);
export default SvgTarget;
