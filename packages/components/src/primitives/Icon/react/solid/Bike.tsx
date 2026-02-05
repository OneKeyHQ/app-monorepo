import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 5a1 1 0 0 1 1-1h1.256a2 2 0 0 1 1.916 1.425l1.378 4.595a5 5 0 1 1-1.916.574l-.278-.927-3.109 3.497a1 1 0 0 1-.247.202V14a2 2 0 0 1-2 2H9.9A5.002 5.002 0 0 1 0 15a5 5 0 0 1 9.9-1H11v-.675L7.191 8.088A1 1 0 0 1 7.134 8H7a1 1 0 0 1 0-2h3a1 1 0 1 1 0 2h-.4l2.503 3.441 3.578-4.025L15.256 6H14a1 1 0 0 1-1-1m-5.17 9a3.001 3.001 0 1 0 0 2H5a1 1 0 1 1 0-2zm9.4-1.422a3 3 0 1 0 1.916-.575l.812 2.71a1 1 0 0 1-1.916.574z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBike;
