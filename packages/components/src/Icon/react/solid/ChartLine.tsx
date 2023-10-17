import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartLine = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm12 3a1 1 0 0 1 1 1v11a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1ZM3.005 10a1 1 0 0 1 1 1L4 19a1 1 0 0 1-2 0l.004-8a1 1 0 0 1 1-1Zm11.993 3a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartLine;
