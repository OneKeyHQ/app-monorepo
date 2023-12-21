import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnonymousHidden = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11h2m-2 0-.755-5.283A2 2 0 0 0 16.265 4h-8.53a2 2 0 0 0-1.98 1.717L5 11m14 0H5m-2 0h2m4.991 5.772a3 3 0 1 0-5.983.457 3 3 0 0 0 5.983-.457Zm0 0a3 3 0 0 1 4.018 0m0 0a3 3 0 1 0 5.983.458 3 3 0 0 0-5.983-.459Z"
    />
  </Svg>
);
export default SvgAnonymousHidden;
