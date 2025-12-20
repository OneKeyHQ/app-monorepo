import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarDays = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1H5zm4.25 6a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m0 4a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0M12 13.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5M13.25 16a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0M16 13.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarDays;
