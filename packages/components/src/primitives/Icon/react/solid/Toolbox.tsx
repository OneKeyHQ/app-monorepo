import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgToolbox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.004 10V6.202a3 3 0 0 0-.657-1.875l-1.25-1.561a2.04 2.04 0 0 0-3.186 0L4.66 4.327a3 3 0 0 0-.657 1.875V10H3a1 1 0 0 0-1 1v7a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-7a1 1 0 0 0-1-1h-1V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6h-.996Zm-3.5-6a.04.04 0 0 0-.032.015L6.223 5.577a1 1 0 0 0-.22.625V10h3V6.202a1 1 0 0 0-.218-.625l-1.25-1.562A.04.04 0 0 0 7.504 4ZM14 10h4V4h-4v2h1.004a1 1 0 1 1 0 2H14v2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgToolbox;
