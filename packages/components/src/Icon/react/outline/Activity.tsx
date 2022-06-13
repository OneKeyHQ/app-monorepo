import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgActivity(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.5 2a1 1 0 01.942.664L12.5 14.027l1.558-4.363A1 1 0 0115 9h3a1 1 0 110 2h-2.295l-2.263 6.336a1 1 0 01-1.884 0L7.5 5.973l-1.558 4.363A1 1 0 015 11H2a1 1 0 110-2h2.295l2.263-6.336A1 1 0 017.5 2z"
        fill="#8C8CA1"
      />
    </Svg>
  );
}

export default SvgActivity;
