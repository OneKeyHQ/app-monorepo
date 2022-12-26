import type { ComponentProps, FC } from 'react';

import Address from '../Address';
import Box from '../Box';
import Typography from '../Typography';

export type AvatarSizeVariant = 'sm' | 'md' | 'lg' | 'xl';

export type AccountProps = {
  /**
   * 账户地址
   */
  address: string;
  /**
   * 隐藏头像头像，默认 展示
   */
  hiddenAvatar?: boolean;
  /**
   * 账户名称
   */
  name?: string | null;
  /**
   * 金额
   */
  amount?: string | null;
  /**
   * 头像大小，默认 'md'
   */
  avatarSize?: AvatarSizeVariant | null;
  /**
   * 优先展示金额，如果有地址的时候优先暂时余额
   */
  priorityAmount?: boolean;
  /**
   * 不展示地址
   */
  notShowAddress?: boolean;
  containerProps?: ComponentProps<typeof Box>;
  color?: string;
};

const defaultProps = {
  avatarSize: 'md',
  hiddenAvatar: false,
} as const;

const Account: FC<AccountProps> = ({
  name,
  address,
  amount,
  priorityAmount,
  notShowAddress,
  containerProps = {},
  color,
}) => {
  let primaryContent: string | null = null;
  let hasPrimaryAddress = false;
  let hasSecondAddress = false;

  if (name != null) {
    primaryContent = name;
  } else if (address != null && !notShowAddress) {
    hasPrimaryAddress = true;
  }

  let secondContent: string | null = null;
  if (!priorityAmount && !hasPrimaryAddress && address && !notShowAddress) {
    hasSecondAddress = true;
  } else if (primaryContent != null || hasPrimaryAddress) {
    secondContent = amount ?? null;
  }

  return (
    <Box
      alignItems="center"
      flexDirection="row"
      justifyContent="flex-start"
      {...containerProps}
    >
      {!!(
        primaryContent ||
        secondContent ||
        hasPrimaryAddress ||
        hasSecondAddress
      ) && (
        <Box>
          {!!(primaryContent || hasPrimaryAddress) &&
            (hasPrimaryAddress ? (
              <Address
                typography="Body2Strong"
                text={address}
                short
                color={color || 'text-default'}
              />
            ) : (
              <Typography.Body2Strong
                color={color || 'text-default'}
                isTruncated
              >
                {primaryContent}
              </Typography.Body2Strong>
            ))}

          {!!(secondContent || hasSecondAddress) &&
            (hasSecondAddress ? (
              <Address
                color={color || 'text-subdued'}
                typography="Body2"
                text={address}
                short
              />
            ) : (
              <Typography.Body2 color={color || 'text-subdued'}>
                {secondContent}
              </Typography.Body2>
            ))}
        </Box>
      )}
    </Box>
  );
};

Account.defaultProps = defaultProps;
export default Account;
