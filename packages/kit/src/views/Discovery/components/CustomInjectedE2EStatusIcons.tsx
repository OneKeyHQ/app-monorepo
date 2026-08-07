import { Icon, Stack, Tooltip, XStack } from '@onekeyhq/components';

export type ICustomInjectedE2EStatusKey =
  | 'adapter'
  | 'generated'
  | 'recorded'
  | 'validated';

const CUSTOM_INJECTED_E2E_STATUS_CONFIG = {
  recorded: {
    activeBackgroundColor: '$bgInfo',
    activeIconColor: '$iconInfo',
    description:
      "Browser interaction recording used as the source for this protocol's E2E workflow.",
    icon: 'RecordCircleOutline',
    label: 'Record',
  },
  generated: {
    activeBackgroundColor: '$bgCaution',
    activeIconColor: '$iconCaution',
    description: 'Repeatable E2E script generated from the browser recording.',
    icon: 'CodeBracketsOutline',
    label: 'Generate',
  },
  validated: {
    activeBackgroundColor: '$bgSuccess',
    activeIconColor: '$iconSuccess',
    description:
      'Validation run that verifies the generated E2E script in OneKey Desktop.',
    icon: 'PlayCircleOutline',
    label: 'Validate',
  },
  adapter: {
    activeBackgroundColor: '$bgAccent',
    activeIconColor: '$iconOnColor',
    description: 'Connect-button adapter implementation for this protocol.',
    icon: 'PuzzleOutline',
    label: 'Adapter',
  },
} as const;

const CUSTOM_INJECTED_E2E_STATUS_ORDER: ICustomInjectedE2EStatusKey[] = [
  'recorded',
  'generated',
  'validated',
  'adapter',
];

export function CustomInjectedE2EStatusIcon({
  active,
  compact = false,
  failed = false,
  showTooltip = true,
  status,
  testID,
}: {
  active: boolean;
  compact?: boolean;
  failed?: boolean;
  showTooltip?: boolean;
  status: ICustomInjectedE2EStatusKey;
  testID?: string;
}) {
  const config = CUSTOM_INJECTED_E2E_STATUS_CONFIG[status];
  const validationFailed = status === 'validated' && failed;
  const stateLabel = validationFailed ? 'failed' : active ? 'complete' : 'incomplete';
  const icon = (
    <Stack
      alignItems="center"
      aria-label={`${config.label}: ${stateLabel}`}
      backgroundColor={
        validationFailed ? '$bgCritical' : active ? config.activeBackgroundColor : '$bgSubdued'
      }
      borderRadius={compact ? '$1' : '$2'}
      h={compact ? '$5' : '$7'}
      justifyContent="center"
      opacity={active || validationFailed ? 1 : 0.5}
      role="img"
      testID={testID}
      w={compact ? '$5' : '$7'}
    >
      <Icon
        color={
          validationFailed ? '$iconCritical' : active ? config.activeIconColor : '$iconSubdued'
        }
        name={config.icon}
        size={compact ? '$3.5' : '$4'}
      />
    </Stack>
  );
  return showTooltip ? (
    <Tooltip renderContent={config.description} renderTrigger={icon} />
  ) : (
    icon
  );
}

export function getCustomInjectedE2EStatusDescription(
  status: ICustomInjectedE2EStatusKey,
) {
  return CUSTOM_INJECTED_E2E_STATUS_CONFIG[status].description;
}

export function CustomInjectedE2EStatusIcons({
  adapter,
  failed = false,
  generated,
  recorded,
  testID,
  validated,
}: {
  adapter: boolean;
  failed?: boolean;
  generated: boolean;
  recorded: boolean;
  testID?: string;
  validated: boolean;
}) {
  const statuses = { adapter, generated, recorded, validated };
  const statusLabel = CUSTOM_INJECTED_E2E_STATUS_ORDER.map(
    (status) =>
      `${CUSTOM_INJECTED_E2E_STATUS_CONFIG[status].label} ${
        status === 'validated' && failed
          ? 'failed'
          : statuses[status]
            ? 'complete'
            : 'incomplete'
      }`,
  ).join(', ');

  return (
    <XStack
      alignItems="center"
      aria-label={`E2E workflow: ${statusLabel}`}
      gap="$1.5"
      justifyContent="flex-end"
      role="group"
      testID={testID}
    >
      {CUSTOM_INJECTED_E2E_STATUS_ORDER.map((status) => (
        <CustomInjectedE2EStatusIcon
          key={status}
          active={statuses[status]}
          failed={status === 'validated' && failed}
          status={status}
          testID={testID ? `${testID}-${status}` : undefined}
        />
      ))}
    </XStack>
  );
}
