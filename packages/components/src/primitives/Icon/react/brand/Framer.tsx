import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFramer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M18.666 2v6.667H12L5.333 2h13.333ZM5.333 8.667H12l6.666 6.666H12V22l-6.667-6.667V8.667Z"
    />
  </Svg>
);
export default SvgFramer;
