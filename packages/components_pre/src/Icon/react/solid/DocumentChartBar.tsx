import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentChartBar = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 17.25a.75.75 0 0 0-1.5 0V18a.75.75 0 0 0 1.5 0v-.75zm2.25-3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 .75-.75zm3.75-1.5a.75.75 0 0 0-1.5 0V18a.75.75 0 0 0 1.5 0v-5.25z"
      clipRule="evenodd"
    />
    <Path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25z" />
  </Svg>
);
export default SvgDocumentChartBar;
