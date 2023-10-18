import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageWaves = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-6.062 5.971c-.988 0-1.826 1.009-2.472 2.2-.52.96-.78 1.44-.702 2.076.06.486.424 1.096.823 1.38C4.108 19 4.775 19 6.108 19h11.64c1.439 0 2.158 0 2.66-.332.417-.276.752-.771.854-1.26.122-.59-.124-1.206-.616-2.437-1.383-3.465-2.797-5.074-4.146-4.963-2.977.247-4.283 4.911-6 4.911-1.427 0-2.758-1.948-4.562-1.948Z"
    />
  </Svg>
);
export default SvgImageWaves;
