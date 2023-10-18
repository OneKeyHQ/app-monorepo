import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgError = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.408 3.458c1.157-1.985 4.025-1.985 5.182 0l7.018 12.03c1.167 2-.276 4.512-2.591 4.512H4.98c-2.315 0-3.758-2.512-2.591-4.512l7.018-12.03ZM12 8a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm-1.25 7a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgError;
