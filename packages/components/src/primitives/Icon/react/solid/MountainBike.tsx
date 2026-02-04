import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMountainBike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 5a1 1 0 0 1 1-1h1.256a2 2 0 0 1 1.916 1.425l1.378 4.595a5 5 0 1 1-1.916.574l-.139-.463-6.688 3.489a5 5 0 1 1-.926-1.773l.812-.423L7.2 8.1a1 1 0 0 1-.066-.1H7a1 1 0 0 1 0-2h3a1 1 0 1 1 0 2h-.375l1.865 2.486 4.42-2.306L15.256 6H14a1 1 0 0 1-1-1m-5.955 7.805a3 3 0 1 0 .925 1.773l-2.507 1.309a1 1 0 1 1-.926-1.774zm10.184-.227a3 3 0 1 0 1.916-.575l.813 2.71a1 1 0 0 1-1.916.574z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMountainBike;
