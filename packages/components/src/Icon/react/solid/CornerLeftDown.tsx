import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerLeftDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M20 5a1 1 0 1 0 0-2h-8a5 5 0 0 0-5 5v10.086l-2.293-2.293a1 1 0 0 0-1.414 1.414L6.586 20.5a2 2 0 0 0 2.828 0l3.293-3.293a1 1 0 0 0-1.414-1.414L9 18.086V8a3 3 0 0 1 3-3h8Z"
    />
  </Svg>
);
export default SvgCornerLeftDown;
