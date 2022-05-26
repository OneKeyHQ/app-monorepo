import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgDiscord = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" stroke="currentColor" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.28 4.045c-1.897.15-3.636.486-4.026.78-.292.22-.908 1.357-1.35 2.492-1.072 2.755-1.9 6.853-1.903 9.414l-.001.83.311.407c.823 1.076 2.485 2.14 4.272 2.737.922.308 1.56.374 1.786.185.079-.065.657-.758 1.285-1.538l1.142-1.42.41.062c.518.078 3.038.08 3.614.003l.435-.058 1.061 1.353c1.364 1.74 1.343 1.72 1.854 1.705.473-.014 1.884-.465 2.699-.862 1.102-.538 2.337-1.488 2.851-2.195l.28-.385-.002-.867c-.006-3.538-1.41-9.076-2.894-11.421-.298-.472-.477-.583-1.259-.778-1.445-.361-2.687-.457-6.291-.484-1.893-.014-3.816.004-4.273.04Zm6.648 1.678c1.384.084 3.004.272 3.509.407.29.077.323.122.726.974 1.066 2.253 1.937 5.953 2.138 9.081l.054.844-.38.338c-.779.69-1.81 1.279-2.9 1.653-.31.106-.587.193-.615.193-.055 0-1.424-1.712-1.424-1.78 0-.023.223-.147.495-.276.757-.36 1.306-.834 1.371-1.185.077-.41-.126-.806-.493-.96-.342-.144-.602-.094-.924.18-1.803 1.53-7.006 1.544-8.921.024-.376-.298-.625-.35-.968-.206-.293.123-.531.47-.531.77 0 .453.572.998 1.49 1.42l.473.217-.631.798c-.895 1.132-.753 1.046-1.383.835-1.154-.388-2.317-1.055-3.027-1.735l-.34-.327.051-.704c.197-2.706.605-4.804 1.443-7.409.37-1.153 1.067-2.644 1.261-2.7 1.49-.432 6.198-.655 9.526-.452ZM7.93 9.85c-.616.158-1.1.833-1.099 1.533 0 .68.356 1.21.993 1.478 1.039.438 2.227-.508 2.09-1.665A1.588 1.588 0 0 0 7.93 9.851Zm7.016.107c-.651.334-1.027 1.202-.81 1.868.205.623.899 1.157 1.505 1.157.632 0 1.335-.563 1.507-1.206.34-1.27-1.044-2.413-2.202-1.819Z"
      strokeWidth={0.5}
    />
  </Svg>
);

export default SvgDiscord;
