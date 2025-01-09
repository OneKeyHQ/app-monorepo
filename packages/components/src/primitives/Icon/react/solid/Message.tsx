import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19.002 3h-14a3 3 0 0 0-3 3v10.036a3 3 0 0 0 3 3h3.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h3.626a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z"
    />
  </Svg>
);
export default SvgMessage;
