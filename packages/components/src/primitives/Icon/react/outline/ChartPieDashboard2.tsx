import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartPieDashboard2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 13a8 8 0 1 1-8-8v5.6c0 .84 0 1.26.164 1.581a1.5 1.5 0 0 0 .655.655c.32.164.74.164 1.581.164H19Zm1.738-4.902a7.014 7.014 0 0 0-4.836-4.836c-.269-.076-.403-.114-.54-.075a.537.537 0 0 0-.287.218C15 3.526 15 3.682 15 3.994V8.2c0 .28 0 .42.055.527a.5.5 0 0 0 .218.219C15.38 9 15.52 9 15.8 9h4.206c.312 0 .468 0 .59-.074a.537.537 0 0 0 .217-.288c.04-.136.001-.27-.075-.54Z"
    />
  </Svg>
);
export default SvgChartPieDashboard2;
