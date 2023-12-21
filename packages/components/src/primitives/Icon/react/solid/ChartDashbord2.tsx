import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartDashbord2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 4a1 1 0 0 1 1-1h20a1 1 0 1 1 0 2h-1v10a3 3 0 0 1-3 3h-4.132l.964 1.445a1 1 0 0 1-1.664 1.11L12 18.803l-1.168 1.752a1 1 0 0 1-1.664-1.11L10.132 18H6a3 3 0 0 1-3-3V5H2a1 1 0 0 1-1-1Zm12 4a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0V8Zm4 2a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0v-3Zm-8 2a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartDashbord2;
