import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPatreon = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19.449 11.994c-1.383 1.451-3.11 1.668-4.982 2.085-1.869.408-2.776 1.828-3.39 3.525-.487 1.368-.959 3.307-2.361 4.049-.86.458-1.947.487-2.772-.06-1.313-.91-1.834-2.543-2.143-4.035-.413-1.957-.753-3.964-.794-5.97-.04-1.701.077-3.594.937-5.113C6.628 1.763 15.03.47 19.124 4.055c2.345 2.043 2.535 5.715.325 7.939Z"
    />
  </Svg>
);
export default SvgPatreon;
