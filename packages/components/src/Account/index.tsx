import React, { FC } from 'react';

import Address from '../Address';
import Avatar from '../Avatar';
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
};

const defaultProps = {
  avatarSize: 'md',
  hiddenAvatar: false,
} as const;

const getIconSize = (size: AvatarSizeVariant | null | undefined): number => {
  const sizeMap: Record<AvatarSizeVariant, number> = {
    'sm': 5,
    'md': 6,
    'lg': 8,
    'xl': 10,
  };
  return sizeMap[size ?? 'md'];
};

const Account: FC<AccountProps> = ({
  hiddenAvatar,
  name,
  address,
  amount,
  avatarSize,
  priorityAmount,
  notShowAddress,
}) => {
  let avatarSizeNumber = getIconSize(avatarSize);
  let avatarMarginRight = 3;
  let avatarAlign = 'center';

  if (avatarSize === 'sm') {
    avatarSizeNumber = 5;
    avatarMarginRight = 2;
    avatarAlign = 'flex-start';
  }

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
    <Box alignItems="center" flexDirection="row" justifyContent="center">
      {!hiddenAvatar && (
        <Box justifyContent={avatarAlign} mr={avatarMarginRight}>
          <Avatar
            address={address ?? ''}
            // @ts-expect-error
            seed={address}
            size={avatarSizeNumber * 4}
          />
        </Box>
      )}
      {!!(
        primaryContent ||
        secondContent ||
        hasPrimaryAddress ||
        hasSecondAddress
      ) && (
        <Box flex={1}>
          {!!(primaryContent || hasPrimaryAddress) &&
            (hasPrimaryAddress ? (
              <Address typography="Body2Strong" text={address} short />
            ) : (
              <Typography.Body2Strong isTruncated>
                {primaryContent}
              </Typography.Body2Strong>
            ))}

          {!!(secondContent || hasSecondAddress) &&
            (hasSecondAddress ? (
              <Address
                color="text-subdued"
                typography="Body2"
                text={address}
                short
              />
            ) : (
              <Typography.Body2 color="text-subdued">
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
