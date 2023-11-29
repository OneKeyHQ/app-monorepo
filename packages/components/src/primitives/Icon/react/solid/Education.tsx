import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEducation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 13.854v2.16a3 3 0 0 0 1.658 2.683l4 2a3 3 0 0 0 2.684 0l4-2A3 3 0 0 0 19 16.014v-2.16l-5.658 2.83a3 3 0 0 1-2.684 0L5 13.853Z"
    />
    <Path
      fill="currentColor"
      d="M21 10.618V15a1 1 0 1 0 2 0V9a1 1 0 0 0-.553-.894l-10-5a1 1 0 0 0-.894 0l-10 5a1 1 0 0 0 0 1.788l10 5a1 1 0 0 0 .894 0L21 10.618Z"
    />
  </Svg>
);
export default SvgEducation;
