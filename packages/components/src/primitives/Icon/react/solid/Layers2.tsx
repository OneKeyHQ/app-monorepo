import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLayers2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m3.57 13-.416.203c-1.497.73-1.497 2.864 0 3.595l7.97 3.887a2 2 0 0 0 1.753 0l7.97-3.887c1.497-.73 1.497-2.865 0-3.595L20.43 13l-7.554 3.685a2 2 0 0 1-1.754 0L3.57 13Z"
    />
    <Path
      fill="currentColor"
      d="M12.877 3.315a2 2 0 0 0-1.754 0L3.154 7.203c-1.497.73-1.497 2.864 0 3.595l7.97 3.887a2 2 0 0 0 1.753 0l7.97-3.887c1.497-.73 1.497-2.865 0-3.595l-7.97-3.888Z"
    />
  </Svg>
);
export default SvgLayers2;
