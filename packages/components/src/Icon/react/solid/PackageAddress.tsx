import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPackageAddress = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 6a1 1 0 0 1 1-1h2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5h2a1 1 0 0 1 1 1v3a1 1 0 1 0 2 0V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h6a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1V6Z"
    />
    <Path
      fill="currentColor"
      d="M21.07 13.414a4 4 0 1 0-5.656 5.657l2.121 2.121a1 1 0 0 0 1.414 0l2.122-2.12a4 4 0 0 0 0-5.658Z"
    />
  </Svg>
);
export default SvgPackageAddress;
