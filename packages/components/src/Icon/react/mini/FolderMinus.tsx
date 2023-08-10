import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderMinus = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 4.75C2 3.784 2.784 3 3.75 3h4.836c.464 0 .909.184 1.237.513l1.414 1.414a.25.25 0 0 0 .177.073h4.836c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 16.25 17H3.75A1.75 1.75 0 0 1 2 15.25V4.75zm10.25 7a.75.75 0 0 0 0-1.5h-4.5a.75.75 0 0 0 0 1.5h4.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderMinus;
