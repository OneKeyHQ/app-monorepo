import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRowsWide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4H2V7Zm0 6v4a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4H2Z"
    />
  </Svg>
);
export default SvgRowsWide;
