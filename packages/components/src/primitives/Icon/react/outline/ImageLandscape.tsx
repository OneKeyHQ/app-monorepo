import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageLandscape = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 10s-2.5 3-1.5 4.5 5.458-.67 6 1.5c.5 2-3.5 3-3.5 3m-1-9c-2.799 0-7.075 2.523-9 3.5m9-3.5c2.799 0 7.075 2.523 9 3.5M13 19h6a2 2 0 0 0 2-2v-3.5M13 19H5a2 2 0 0 1-2-2v-3.5m0 0V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6.5"
    />
  </Svg>
);
export default SvgImageLandscape;
