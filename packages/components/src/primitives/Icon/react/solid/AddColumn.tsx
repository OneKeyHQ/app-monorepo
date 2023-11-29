import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddColumn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19 6h-6v13a1 1 0 0 1-1 1H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a1 1 0 1 1-2 0V7a1 1 0 0 0-1-1Z"
    />
    <Path
      fill="currentColor"
      d="M20 14a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
    />
  </Svg>
);
export default SvgAddColumn;
