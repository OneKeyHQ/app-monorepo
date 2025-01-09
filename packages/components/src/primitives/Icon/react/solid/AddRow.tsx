import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddRow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6a1 1 0 1 0 0-2H5a1 1 0 0 1-1-1v-4h17a1 1 0 0 0 1-1V7a3 3 0 0 0-3-3H5Zm15 12a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
    />
  </Svg>
);
export default SvgAddRow;
