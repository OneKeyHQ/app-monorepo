import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBlockExplorer = (props: SvgProps) => (
  <Svg viewBox="0 0 32 32" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16ZM4.664 12.055A12.024 12.024 0 0 1 8.488 6.64 2.997 2.997 0 0 0 11 8a3 3 0 0 1 3 3v1a4 4 0 1 0 8 0 4.002 4.002 0 0 1 3.046-3.886A11.954 11.954 0 0 1 28 16c0 .681-.057 1.35-.166 2H26a4 4 0 0 0-4 4v4.395A11.945 11.945 0 0 1 16 28v-4a4 4 0 0 0-4-4 4 4 0 0 1-4-4 4.001 4.001 0 0 0-3.336-3.945Z"
      fill="#7747FF"
    />
  </Svg>
);
export default SvgBlockExplorer;
