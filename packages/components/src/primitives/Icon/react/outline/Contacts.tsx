import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgContacts = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 20 20" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.333 4.167a2.5 2.5 0 0 1 2.5-2.5H15c.92 0 1.666.746 1.666 1.666V15c0 .46-.373.833-.833.833H5.416a.417.417 0 1 0 0 .834h10.417a.833.833 0 0 1 0 1.666H5.416a2.083 2.083 0 0 1-2.083-2.083zM5 14.208q.202-.04.416-.041H15V3.333H5.833A.833.833 0 0 0 5 4.167zM8.54 7.292a1.458 1.458 0 1 1 2.917 0 1.458 1.458 0 0 1-2.917 0m-.265 2.302c.415-.271.979-.427 1.724-.427.744 0 1.308.156 1.723.427.424.276.623.626.71.881.238.698-.36 1.192-.859 1.192H8.425c-.498 0-1.097-.494-.859-1.192.088-.255.287-.605.71-.881"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgContacts;
