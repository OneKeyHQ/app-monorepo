import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSearchDocumentDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path fill="#fff" d="M50 32h86v111H50z" />
    <Path fill="#000" stroke="#fff" d="M133.5 34.5v112h-87v-112z" />
    <Path
      stroke="#fff"
      strokeLinejoin="round"
      strokeMiterlimit={16}
      d="M54.5 43h17M55 138h68"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="m127.371 130.545 6.245-3.162 13.866 27.385-6.245 3.162z"
    />
    <Path
      fill="#3EDC2F"
      stroke="#000"
      d="M106.418 82.525c13.303-6.736 29.549-1.412 36.285 11.891s1.412 29.549-11.891 36.285-29.549 1.412-36.285-11.891-1.412-29.548 11.891-36.285ZM138.37 96.61c-5.525-10.91-18.848-15.278-29.759-9.754-10.91 5.525-15.277 18.849-9.753 29.76 5.525 10.911 18.849 15.278 29.76 9.753s15.277-18.848 9.752-29.759Z"
    />
  </Svg>
);
export default SvgSearchDocumentDark;
