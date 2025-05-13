import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOrganisation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a5.5 5.5 0 0 0-1 10.91v1.235A3.51 3.51 0 0 0 8.645 16.5h-.79A3.502 3.502 0 0 0 1 17.5a3.5 3.5 0 0 0 6.855 1h.79a3.502 3.502 0 0 0 6.71 0h.79a3.502 3.502 0 0 0 6.855-1 3.5 3.5 0 0 0-6.855-1h-.79A3.51 3.51 0 0 0 13 14.145v-1.236A5.502 5.502 0 0 0 12 2M8.5 7.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0M3 17.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m7.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m7.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOrganisation;
