import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChip = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 7H7v6h6V7z" />
    <Path
      fillRule="evenodd"
      d="M7 2a1 1 0 0 1 2 0v1h2V2a1 1 0 1 1 2 0v1h2a2 2 0 0 1 2 2v2h1a1 1 0 1 1 0 2h-1v2h1a1 1 0 1 1 0 2h-1v2a2 2 0 0 1-2 2h-2v1a1 1 0 1 1-2 0v-1H9v1a1 1 0 1 1-2 0v-1H5a2 2 0 0 1-2-2v-2H2a1 1 0 1 1 0-2h1V9H2a1 1 0 0 1 0-2h1V5a2 2 0 0 1 2-2h2V2zM5 5h10v10H5V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChip;
