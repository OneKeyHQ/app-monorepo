import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEarth = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10Zm-7.462 5a.75.75 0 0 0 .671-.415l.498-.995a.75.75 0 0 0-.253-.958l-2.232-1.5a.75.75 0 0 0-.37-.126l-1.404-.09a.75.75 0 0 0-.577.218l-.433.431a.75.75 0 0 0-.094.948l1.435 2.153a.75.75 0 0 0 .624.334h2.135Zm-6.133-6.802a.75.75 0 0 1-1.121.261L5.261 8.934a.704.704 0 0 1-.204-.911 7.997 7.997 0 0 1 8.152-3.932c.41.062.654.473.553.875l-.652 2.599a.75.75 0 0 1-.544.544l-3.227.812a.75.75 0 0 0-.487.39l-.447.887Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEarth;
