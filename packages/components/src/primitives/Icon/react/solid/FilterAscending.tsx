import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilterAscending = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 3a1 1 0 0 1 1 1v13.586l1.293-1.293a1 1 0 0 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L6 17.586V4a1 1 0 0 1 1-1m10.5 0c.811 0 1.527.53 1.764 1.306l1.189 3.89.496 1.488a1 1 0 0 1-1.898.632L18.78 9.5h-2.558l-.272.816a1 1 0 0 1-1.898-.632l.496-1.488 1.189-3.89A1.84 1.84 0 0 1 17.5 3m0 2.377L16.851 7.5h1.298zM14 14a1 1 0 0 1 1-1h5a1 1 0 0 1 .768 1.64L17.135 19H20a1 1 0 1 1 0 2h-5a1 1 0 0 1-.768-1.64L17.865 15H15a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFilterAscending;
