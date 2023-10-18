import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLab2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M21.004 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.004 5 4 15a3.536 3.536 0 0 0 5 5l10.004-10m-5-5 5 5m-5-5L13 4m6.004 6L20 11M6.004 13h10"
    />
  </Svg>
);
export default SvgLab2;
