import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPackageAddress = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M9 4v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4m3.243 16.485-2.122-2.121a3 3 0 1 1 4.243 0l-2.121 2.121Z"
    />
  </Svg>
);
export default SvgPackageAddress;
