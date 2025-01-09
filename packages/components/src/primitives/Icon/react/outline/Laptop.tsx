import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLaptop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6ZM2 16h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2Z"
    />
  </Svg>
);
export default SvgLaptop;
