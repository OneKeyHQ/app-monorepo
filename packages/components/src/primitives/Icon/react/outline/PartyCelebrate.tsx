import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPartyCelebrate = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 2s.178 1.04 0 2c-.191 1.034-1 2-1 2m2.5 2.5 1-1m1.8-2.75.45-1.25M20 8l1-.5M18 11s.756.032 1.5.27c.67.215 1.5.73 1.5.73M5.78 20.814l9.383-3.696a2 2 0 0 0 .68-3.275l-5.685-5.686a2 2 0 0 0-3.275.681L3.186 18.22c-.64 1.627.967 3.235 2.594 2.594Z"
    />
  </Svg>
);
export default SvgPartyCelebrate;
