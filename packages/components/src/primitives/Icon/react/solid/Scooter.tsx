import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgScooter = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      d="M14 4a1 1 0 1 0 0 2h.86a1 1 0 0 1 .981.804l1.294 6.472a3.51 3.51 0 0 0-1.99 2.224h-6.29A3.502 3.502 0 0 0 2 16.5a3.5 3.5 0 0 0 6.855 1h6.29a3.502 3.502 0 0 0 6.855-1 3.501 3.501 0 0 0-2.869-3.443l-1.329-6.645A3 3 0 0 0 14.86 4H14Z"
    />
  </Svg>
);
export default SvgScooter;
