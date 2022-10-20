import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRestore = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.988 16a6.047 6.047 0 0 1-3.99-1.486 5.991 5.991 0 0 1-2.007-3.735 1 1 0 1 0-1.982.261 7.991 7.991 0 0 0 2.676 4.983 8.047 8.047 0 0 0 10.607-.032 7.977 7.977 0 0 0 1.316-10.492 8.03 8.03 0 0 0-4.639-3.247A8.057 8.057 0 0 0 4 4.65V3.035a1 1 0 1 0-2 0V7a1 1 0 0 0 1 1h4.394a1 1 0 1 0 0-2H5.476a6.057 6.057 0 0 1 5.997-1.81 6.03 6.03 0 0 1 3.484 2.437 5.977 5.977 0 0 1-.988 7.864A6.047 6.047 0 0 1 9.989 16Z"
    />
  </Svg>
);
export default SvgRestore;
