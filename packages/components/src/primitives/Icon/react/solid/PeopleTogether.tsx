import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleTogether = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.5 12c3.179 0 6.14 2.414 6.861 6.767.206 1.24-.798 2.233-1.934 2.233H2.573c-1.136 0-2.14-.993-1.934-2.233C1.36 14.414 4.32 12 7.5 12m9 0c3.179 0 6.14 2.414 6.861 6.767.206 1.24-.798 2.233-1.934 2.233h-5.538c.415-.72.606-1.596.446-2.56-.388-2.342-1.358-4.3-2.706-5.739A6.2 6.2 0 0 1 16.5 12m-9-9a4 4 0 1 1 0 8 4 4 0 0 1 0-8m9 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8" />
  </Svg>
);
export default SvgPeopleTogether;
