import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 6a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3H5v3a1 1 0 0 0 1 1h7a1 1 0 0 1 1 1v2.17c1.165.412 2 1.524 2 2.83v3a1 1 0 1 1-2 0v-3a1 1 0 1 0-2 0v3a1 1 0 1 1-2 0v-3c0-1.306.835-2.418 2-2.83V14H6a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2h1Z"
    />
  </Svg>
);
export default SvgColor;
