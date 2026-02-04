import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronGrabberVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m12 6.49 3.248 3.248a.987.987 0 0 0 1.396-1.395L13.22 4.92a1.726 1.726 0 0 0-2.442 0L7.356 8.343a.987.987 0 0 0 1.395 1.395zm-4.644 7.772a.986.986 0 0 1 1.395 0L12 17.511l3.248-3.249a.987.987 0 1 1 1.396 1.395L13.22 19.08a1.727 1.727 0 0 1-2.442 0l-3.423-3.423a.987.987 0 0 1 0-1.395Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronGrabberVer;
