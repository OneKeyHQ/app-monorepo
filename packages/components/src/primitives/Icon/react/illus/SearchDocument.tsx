import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSearchDocument = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path fill="#000" d="M50 32h86v111H50z" />
    <Path fill="#fff" stroke="#000" d="M47 35h86v111H47z" />
    <Path
      stroke="#000"
      strokeLinejoin="round"
      strokeMiterlimit={16}
      d="M54.5 43h17M55 138h68"
    />
    <Path
      fill="#000"
      stroke="#fff"
      d="m128.355 131.384 5.353-2.71 13.1 25.872-5.353 2.71z"
    />
    <Path
      fill="#3EDC2F"
      fillRule="evenodd"
      stroke="#000"
      d="M106.644 82.972c13.057-6.612 29.002-1.386 35.613 11.67 6.611 13.058 1.386 29.002-11.671 35.614s-29.002 1.386-35.613-11.671c-6.611-13.058-1.386-29.002 11.671-35.613Zm1.742 3.44c-11.158 5.649-15.623 19.273-9.973 30.431 5.649 11.157 19.274 15.622 30.431 9.973 11.157-5.65 15.622-19.274 9.973-30.431-5.65-11.157-19.274-15.623-30.431-9.974Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSearchDocument;
