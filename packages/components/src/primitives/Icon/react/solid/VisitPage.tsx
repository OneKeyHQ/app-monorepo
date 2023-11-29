import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVisitPage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5.25a1 1 0 1 1-2 0V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 1 1 0 2H5a3 3 0 0 1-3-3V7Z"
    />
    <Path
      fill="currentColor"
      d="M5.5 8.75a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm3.5 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm3.5 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm2.294 4.794a1 1 0 0 0-1.25 1.25l2 6.5a1 1 0 0 0 1.85.153l1.351-2.702 2.702-1.35a1 1 0 0 0-.153-1.85l-6.5-2Z"
    />
  </Svg>
);
export default SvgVisitPage;
