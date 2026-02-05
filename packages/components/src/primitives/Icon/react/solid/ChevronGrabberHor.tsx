import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronGrabberHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.738 7.222a.987.987 0 0 1 0 1.395l-3.249 3.248 3.249 3.249a.987.987 0 0 1-1.395 1.395L4.92 13.086a1.726 1.726 0 0 1 0-2.441l3.423-3.423a.987.987 0 0 1 1.395 0m4.524 0a.987.987 0 0 1 1.395 0l3.423 3.423a1.727 1.727 0 0 1 0 2.441l-3.423 3.423a.987.987 0 1 1-1.395-1.395l3.248-3.249-3.248-3.248a.986.986 0 0 1 0-1.395"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronGrabberHor;
