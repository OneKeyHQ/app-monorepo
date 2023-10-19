import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCirclePlaceholderOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M20.868 16.626A9.958 9.958 0 0 0 22 12c0-5.523-4.477-10-10-10a9.957 9.957 0 0 0-4.626 1.132l13.494 13.494ZM4.257 5.671 3.043 4.457a1 1 0 0 1 1.414-1.414l1.871 1.871.015.015 12.728 12.728.015.014 1.871 1.872a1 1 0 0 1-1.414 1.414l-1.215-1.214A9.962 9.962 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.401.847-4.605 2.257-6.329Z"
    />
  </Svg>
);
export default SvgCirclePlaceholderOff;
