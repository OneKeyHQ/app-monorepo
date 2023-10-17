import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLayers3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.316 3.185a2 2 0 0 1 1.367 0l8.074 2.936c1.755.638 1.755 3.12 0 3.759l-8.074 2.936a2 2 0 0 1-1.367 0L3.242 9.88c-1.755-.638-1.755-3.12 0-3.76l8.074-2.935ZM20.073 8 12 5.064 3.926 8 12 10.936 20.073 8Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m20.757 13.88-8.074 2.936a2 2 0 0 1-1.367 0L3.242 13.88c-1.139-.414-1.539-1.605-1.2-2.564L12 14.936l9.957-3.62c.339.96-.061 2.15-1.2 2.564Z"
    />
    <Path
      fill="currentColor"
      d="m20.757 17.88-8.074 2.936a2 2 0 0 1-1.367 0L3.242 17.88c-1.139-.414-1.539-1.605-1.2-2.564L12 18.936l9.957-3.62c.339.96-.061 2.15-1.2 2.564Z"
    />
  </Svg>
);
export default SvgLayers3;
