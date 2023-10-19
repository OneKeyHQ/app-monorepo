import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 13h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3m0 9V4m0 9-3.699 7.45a.99.99 0 0 1-.886.55 1.998 1.998 0 0 1-1.97-2.308L11.02 15H5.99a2.996 2.996 0 0 1-2.961-3.405l.68-5A2.993 2.993 0 0 1 6.668 4H17"
    />
  </Svg>
);
export default SvgThumbDown;
