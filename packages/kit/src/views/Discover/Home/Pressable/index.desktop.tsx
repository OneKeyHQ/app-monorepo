import { ComponentPropsWithoutRef, useRef, FC, useCallback } from 'react'
import { type GestureResponderEvent} from 'react-native'
import { Pressable as PressableOrigin } from '@onekeyhq/components'

type Props = ComponentPropsWithoutRef<typeof PressableOrigin>

export const Pressable: FC<Props> = ({ onPress, ...rest }) => {
    const ref = useRef<any>()
    const handlePress = useCallback((e: GestureResponderEvent) => {
        ref.current?.blur?.()
        onPress?.(e)
    }, [onPress])
    return <PressableOrigin ref={ref} {...rest} onPress={handlePress}></PressableOrigin>
}