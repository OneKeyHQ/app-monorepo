import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRemoveColumn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19 6h-6v13a1 1 0 0 1-1 1H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a1 1 0 1 1-2 0V7a1 1 0 0 0-1-1Z"
    />
    <Path
      fill="currentColor"
      d="M17.707 14.293a1 1 0 0 0-1.414 1.414L17.586 17l-1.293 1.293a1 1 0 0 0 1.414 1.414L19 18.414l1.293 1.293a1 1 0 0 0 1.414-1.414L20.414 17l1.293-1.293a1 1 0 0 0-1.414-1.414L19 15.586l-1.293-1.293Z"
    />
  </Svg>
);
export default SvgRemoveColumn;
