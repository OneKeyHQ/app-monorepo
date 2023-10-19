import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageLike = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.002 3h12a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-2.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-2.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM12 15c.333 0 4-1.86 4-4.375C16 8.875 14.889 8 13.778 8S12 8.656 12 8.656 11.333 8 10.222 8C9.112 8 8 8.875 8 10.625 8 13.141 11.667 15 12 15Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageLike;
