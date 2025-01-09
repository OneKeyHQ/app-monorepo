import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBallVolleyball = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12c1.35-2.485 1.35-6.515 0-9m0 9c-2.827.074-6.317 2.088-7.794 4.5M12 12c1.477 2.412 4.967 4.426 7.794 4.5m-12.29-3.066c1.702 2.78 4.9 5.258 8.312 6.709m-12.772-8.99c2.988-2.19 6.715-3.681 9.964-3.766m2.485 7.791C17.05 12.314 17.6 8.31 17.157 4.63m1.207 1.007A9 9 0 1 1 5.636 18.364 9 9 0 0 1 18.364 5.636Z"
    />
  </Svg>
);
export default SvgBallVolleyball;
