import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.002 2.401c0-1.484-1.925-2.067-2.748-.832L3.188 13.668c-.665.997.05 2.332 1.248 2.332h5.566v5.599c0 1.484 1.925 2.067 2.748.832l8.066-12.099C21.48 9.335 20.766 8 19.568 8h-5.566V2.401Z"
    />
  </Svg>
);
export default SvgFlash;
