import type { PropsWithChildren, ReactElement } from 'react';
import { Children, createContext, useContext, useMemo } from 'react';

import { withStaticProperties } from 'tamagui';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { Badge } from '../../content';
import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

import type { IYStackProps } from '../../primitives';

export enum EStepItemStatus {
  Done = 'done',
  Failed = 'failed',
  Pending = 'pending',
  Inactive = 'inactive',
}

interface IStepItemStatusProps {
  status: EStepItemStatus;
}

function StepItemStatus({ status }: IStepItemStatusProps) {
  switch (status) {
    case EStepItemStatus.Inactive:
      return <Icon name="CirclePlaceholderOnOutline" color="$iconDisabled" />;
    case EStepItemStatus.Pending:
      return <Spinner size="small" />;
    case EStepItemStatus.Done:
      return <Icon name="CheckRadioSolid" color="$iconSuccess" />;
    default:
      return <Icon name="XCircleSolid" color="$iconCritical" />;
  }
}
export interface IStepItemProviderProps {
  index: number;
}

const StepperItemContext = createContext<IStepItemProviderProps | undefined>(
  undefined,
);

export function useStepperItemContext() {
  const context = useContext(StepperItemContext);
  return context;
}

export function StepItemProvider({
  children,
  index,
}: PropsWithChildren<IStepItemProviderProps>) {
  const contextValue = useMemo(
    () => ({
      index,
    }),
    [index],
  );

  return (
    <StepperItemContext.Provider value={contextValue}>
      {children}
    </StepperItemContext.Provider>
  );
}

interface IStepperItemRenderProps {
  stepIndex: number;
  index?: number;
  status: EStepItemStatus;
}

export interface IStepItemProps {
  title?: string;
  description?: string;
  renderProgressBar?: ReactElement | null;
  renderStatusIndicator?: (props: IStepItemStatusProps) => ReactElement | null;
  renderTitle?: (props: IStepperItemRenderProps) => ReactElement | null;
  renderDescription?: (props: IStepperItemRenderProps) => ReactElement | null;
  renderAction?: (props: IStepperItemRenderProps) => ReactElement | null;
  badgeText?: string;
  containerStyle?: IYStackProps;
  textContainerStyle?: IYStackProps;
}

export interface IStepperContextProps {
  stepIndex: number;
  stepsCount: number;
  hasError?: boolean;
}

const StepperContext = createContext<IStepperContextProps | undefined>(
  undefined,
);

export function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useStepperContext must be used within a StepProvider',
    );
  }
  return context;
}

export function StepItem({
  title,
  description,
  badgeText,
  renderStatusIndicator,
  renderProgressBar,
  renderTitle,
  renderDescription,
  renderAction,
  containerStyle,
  textContainerStyle,
}: IStepItemProps) {
  const { stepIndex, hasError, stepsCount } = useStepperContext();
  const { index } = useStepperItemContext() || {};
  const status = useMemo(() => {
    if (index === undefined) {
      return EStepItemStatus.Inactive;
    }
    if (stepIndex < index) {
      return EStepItemStatus.Inactive;
    }
    if (stepIndex > index) {
      return EStepItemStatus.Done;
    }
    if (hasError) {
      return EStepItemStatus.Failed;
    }
    return EStepItemStatus.Pending;
  }, [index, hasError, stepIndex]);
  const renderProps = useMemo(
    () => ({
      status,
      stepIndex,
      index,
    }),
    [index, status, stepIndex],
  );
  const progressBarElement = useMemo(() => {
    return (
      renderProgressBar || (
        <Stack
          flex={1}
          position="absolute"
          left={11}
          top="$8"
          bottom="$2"
          w="$0.5"
          bg="$iconDisabled"
          borderRadius="$full"
        />
      )
    );
  }, [renderProgressBar]);
  return (
    <XStack gap="$3" pb="$10" {...containerStyle}>
      {renderStatusIndicator ? (
        renderStatusIndicator({ status })
      ) : (
        <YStack w="$6" h="$6" ai="center" jc="center">
          <StepItemStatus status={status} />
        </YStack>
      )}
      <YStack gap="$4" flex={1}>
        <YStack gap="$2" {...textContainerStyle}>
          <XStack gap="$2" ai="center">
            {title ? (
              <SizableText
                size={
                  status === EStepItemStatus.Pending ? '$headingMd' : '$bodyLg'
                }
              >
                {title}
              </SizableText>
            ) : null}
            {renderTitle ? renderTitle(renderProps) : null}
            {badgeText ? (
              <Badge badgeSize="lg" badgeType="success">
                <Badge.Text>{badgeText}</Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          {renderDescription ? renderDescription(renderProps) : null}
          {description ? (
            <SizableText size="$bodyLg" color="$textSubdued">
              {description}
            </SizableText>
          ) : null}
        </YStack>
        {renderAction ? renderAction(renderProps) : null}
      </YStack>
      {index !== stepsCount - 1 ? progressBarElement : null}
    </XStack>
  );
}

export type IStepperProps = PropsWithChildren<
  Omit<IStepperContextProps, 'stepsCount'>
>;

function StepProvider({ children, stepIndex, hasError }: IStepperProps) {
  const stepsCount = useMemo(() => Children.count(children), [children]);
  const contextValue = useMemo(
    () => ({ stepIndex, hasError, stepsCount }),
    [stepIndex, hasError, stepsCount],
  );

  return (
    <StepperContext.Provider value={contextValue}>
      {Children.map(children, (child, index) => (
        <StepItemProvider index={index}>{child}</StepItemProvider>
      ))}
    </StepperContext.Provider>
  );
}

export const Stepper = withStaticProperties(StepProvider, {
  Item: StepItem,
});
