import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPhoneOutgoing = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.924 2.617a.997.997 0 0 0-.215-.322l-.004-.004A.997.997 0 0 0 17 2h-4a1 1 0 1 0 0 2h1.586l-3.293 3.293a1 1 0 0 0 1.414 1.414L16 5.414V7a1 1 0 1 0 2 0V3a.997.997 0 0 0-.076-.383z" />
    <Path d="M2 3a1 1 0 0 1 1-1h2.153a1 1 0 0 1 .986.836l.74 4.435a1 1 0 0 1-.54 1.06l-1.548.773a11.037 11.037 0 0 0 6.105 6.105l.774-1.548a1 1 0 0 1 1.059-.54l4.435.74a1 1 0 0 1 .836.986V17a1 1 0 0 1-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </Svg>
);
export default SvgPhoneOutgoing;
