import { type FC } from 'react'
import { Stack } from '../Stack'

type DividerProps = {
    direction?: 'vertical' | 'horizontal'
}

export const Divider: FC<DividerProps> = ({ direction }) => {
    return direction === 'vertical' ? <Stack w='$px' h='100%' backgroundColor={'$borderSubdued'}></Stack>: <Stack h='$px' w='100%' backgroundColor={'$borderSubdued'}></Stack>;
}