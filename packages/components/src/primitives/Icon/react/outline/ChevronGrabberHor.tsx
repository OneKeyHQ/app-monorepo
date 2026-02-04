import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronGrabberHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.657 16.509a.986.986 0 0 1-1.395-1.395l3.249-3.249-3.249-3.248a.986.986 0 0 1 1.395-1.395l3.423 3.423a1.726 1.726 0 0 1 0 2.44zm-5.92 0a.986.986 0 0 1-1.394 0L4.92 13.086a1.726 1.726 0 0 1 0-2.441l3.423-3.423a.986.986 0 1 1 1.395 1.395l-3.249 3.248 3.249 3.249a.986.986 0 0 1 0 1.395Z" />
  </Svg>
);
export default SvgChevronGrabberHor;
