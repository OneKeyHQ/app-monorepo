import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompassSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm11.524 3.248a1 1 0 0 1 1.228 1.228l-1.12 4.104a1.5 1.5 0 0 1-1.052 1.053l-4.104 1.12a1 1 0 0 1-1.228-1.229l1.12-4.104a1.5 1.5 0 0 1 1.052-1.053z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassSquare;
