import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgH3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1 1v6h8V5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0v-6H4v6a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm17 8a1 1 0 0 0-.867.5 1 1 0 0 1-1.731-1A3 3 0 0 1 23 13c0 .768-.289 1.47-.764 2a3 3 0 1 1-4.834 3.5 1 1 0 1 1 1.731-1A1 1 0 1 0 20 16a1 1 0 1 1 0-2 1 1 0 1 0 0-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgH3;
