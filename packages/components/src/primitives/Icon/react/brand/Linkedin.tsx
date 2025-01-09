import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLinkedin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19.65 3H4.35A1.35 1.35 0 0 0 3 4.35v15.3A1.35 1.35 0 0 0 4.35 21h15.3A1.35 1.35 0 0 0 21 19.65V4.35A1.35 1.35 0 0 0 19.65 3ZM8.4 18.3H5.7v-8.1h2.7v8.1ZM7.05 8.625A1.575 1.575 0 1 1 8.67 7.05a1.602 1.602 0 0 1-1.62 1.575ZM18.3 18.3h-2.7v-4.266c0-1.278-.54-1.737-1.242-1.737a1.565 1.565 0 0 0-1.458 1.674.59.59 0 0 0 0 .126V18.3h-2.7v-8.1h2.61v1.17a2.799 2.799 0 0 1 2.43-1.26c1.395 0 3.024.774 3.024 3.294L18.3 18.3Z"
    />
  </Svg>
);
export default SvgLinkedin;
