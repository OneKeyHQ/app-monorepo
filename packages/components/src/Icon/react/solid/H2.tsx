import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgH2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1 1v6h8V5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0v-6H4v6a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm17 8a1 1 0 0 0-.867.5 1 1 0 0 1-1.731-1A3 3 0 0 1 23 13v.24a3 3 0 0 1-.736 1.968L20.062 18H22a1 1 0 1 1 0 2h-4a1 1 0 0 1-.785-1.62l3.495-4.43.037-.046A1 1 0 0 0 21 13.24V13a1 1 0 0 0-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgH2;
