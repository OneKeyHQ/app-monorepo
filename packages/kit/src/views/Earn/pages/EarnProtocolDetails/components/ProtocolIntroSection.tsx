import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import Svg, { Path } from 'react-native-svg';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { EarnTestIDs } from '@onekeyhq/kit/src/views/Earn/testIDs';
import { EarnIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnProtocolIntroAudit,
  IEarnProtocolIntroAudits,
  IEarnProtocolIntroInfo,
  IEarnProtocolIntroInvestorRound,
  IEarnProtocolIntroInvestors,
  IEarnProtocolIntroItem,
  IEarnProtocolIntroLooseIcon,
  IEarnProtocolIntroMetric,
  IEarnProtocolIntroSocialLink,
  IEarnProtocolIntroTag,
  IEarnProtocolIntroTeam,
  IEarnProtocolIntroTeamMember,
  IEarnProtocolIntroText,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

function toEarnText(text?: IEarnProtocolIntroText): IEarnText | undefined {
  if (!text) {
    return undefined;
  }
  return typeof text === 'string' ? { text } : text;
}

function getText(text?: IEarnProtocolIntroText): string | undefined {
  return typeof text === 'string' ? text : text?.text;
}

function hasText(text?: IEarnProtocolIntroText) {
  return Boolean(getText(text)?.trim());
}

function getItemTitle(item?: IEarnProtocolIntroItem) {
  return item?.title || item?.displayName || item?.name;
}

const protocolTypeLabelMap: Record<string, ETranslations> = {
  complex_earn: ETranslations.earn_yield,
  complex_protocol: ETranslations.earn_yield,
  nested_earn: ETranslations.earn_yield,
  pendle: ETranslations.earn_yield,
  simple_earn: ETranslations.global_asset,
  simple_protocol: ETranslations.global_asset,
  strategy: ETranslations.earn_yield,
  underlying: ETranslations.global_asset,
  underlying_asset: ETranslations.global_asset,
  yield_strategy: ETranslations.earn_yield,
};

const protocolProviderLabelMap: Record<string, ETranslations> = {
  ethena: ETranslations.global_asset,
  pendle: ETranslations.earn_yield,
};

const protocolLogoFallbackMap: Record<string, string> = {
  ethena: 'https://uni.onekey-asset.com/static/logo/ethena.png',
  everstake: 'https://uni.onekey-asset.com/static/logo/everstake.png',
  morpho: 'https://uni.onekey-asset.com/static/logo/morpho.png',
  pendle: 'https://uni.onekey-asset.com/static/logo/pendle.png',
  stakefish: 'https://uni.onekey-asset.com/static/logo/stakefish.png',
};

const AUDIT_NAME_COLUMN_WIDTH = 172;

function getItemSubtitle(
  item: IEarnProtocolIntroItem | undefined,
  intl: ReturnType<typeof useIntl>,
) {
  const labelId =
    (item?.type ? protocolTypeLabelMap[item.type] : undefined) ||
    (item?.provider ? protocolProviderLabelMap[item.provider] : undefined) ||
    (item?.slug ? protocolProviderLabelMap[item.slug] : undefined);

  return (
    item?.role || (labelId ? intl.formatMessage({ id: labelId }) : undefined)
  );
}

function getProtocolLogoURI(
  item: Pick<
    IEarnProtocolIntroItem,
    | 'logoURI'
    | 'logoUrl'
    | 'logoUri'
    | 'providerLogoURI'
    | 'providerLogoUrl'
    | 'providerLogoUri'
    | 'provider'
    | 'slug'
    | 'title'
    | 'displayName'
    | 'name'
  >,
) {
  const logoURI =
    item.logoURI ||
    item.logoUrl ||
    item.logoUri ||
    item.providerLogoURI ||
    item.providerLogoUrl ||
    item.providerLogoUri;

  if (logoURI) {
    return logoURI;
  }

  const fallbackKey = [item.provider, item.slug, getText(getItemTitle(item))]
    .filter(Boolean)
    .map((key) => key?.trim().toLowerCase())
    .find((key) => (key ? protocolLogoFallbackMap[key] : undefined));

  return fallbackKey ? protocolLogoFallbackMap[fallbackKey] : undefined;
}

function getTagText(tag?: IEarnProtocolIntroTag) {
  if (!tag || typeof tag === 'string' || 'text' in tag) {
    return tag as IEarnProtocolIntroText | undefined;
  }
  return tag.tag || tag.title;
}

function getMetricValue(metric?: IEarnProtocolIntroMetric) {
  return metric?.value || metric?.description;
}

function getSafeExternalUrl(...urls: Array<string | null | undefined>) {
  for (const url of urls) {
    const normalizedUrl = url?.trim();
    if (normalizedUrl) {
      try {
        const parsedUrl = new URL(normalizedUrl);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
          return normalizedUrl;
        }
      } catch {
        // Invalid URL candidates are skipped so later aliases can still work.
      }
    }
  }

  return undefined;
}

function getLinkUrl(link?: IEarnProtocolIntroSocialLink) {
  return getSafeExternalUrl(link?.url, link?.data?.link);
}

function getVisibleLinks(
  ...linkGroups: Array<IEarnProtocolIntroSocialLink[] | undefined>
) {
  const seen = new Set<string>();

  return linkGroups
    .flatMap((links) => links ?? [])
    .filter((link) => {
      if (link.disabled) {
        return false;
      }

      const url = getLinkUrl(link);
      if (!url || seen.has(url)) {
        return false;
      }

      seen.add(url);
      return true;
    });
}

function getHostname(url?: string) {
  const safeUrl = getSafeExternalUrl(url);
  if (!safeUrl) {
    return undefined;
  }
  try {
    return new URL(safeUrl).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

const iconNameMap: Record<string, IKeyOfIcons> = {
  DiscordBrand: 'DiscordBrand',
  DiscordBrandOutline: 'DiscordBrand',
  'GlobusOutline': 'GlobusOutline',
  LinkedinBrand: 'LinkedinBrand',
  LinkedinOutline: 'LinkedinBrand',
  OpenOutline: 'OpenOutline',
  TelegramBrand: 'TelegramBrand',
  XBrandOutline: 'Xbrand',
  'Xbrand': 'Xbrand',
};

function normalizeIconName(icon?: IEarnProtocolIntroLooseIcon) {
  const iconName = icon?.icon;
  return iconName ? iconNameMap[iconName] : undefined;
}

function getLinkIcon(link: IEarnProtocolIntroSocialLink): IKeyOfIcons {
  const iconName = normalizeIconName(link.data?.icon || link.icon);
  if (iconName) {
    return iconName;
  }

  const type = link.type?.toLowerCase();
  if (type === 'website') {
    return 'GlobusOutline';
  }
  if (type === 'twitter' || type === 'x') {
    return 'Xbrand';
  }
  if (type === 'discord') {
    return 'DiscordBrand';
  }
  if (type === 'linkedin') {
    return 'LinkedinBrand';
  }
  if (type === 'telegram') {
    return 'TelegramBrand';
  }

  const hostname = getHostname(getLinkUrl(link));
  if (hostname?.includes('discord')) {
    return 'DiscordBrand';
  }
  if (hostname === 'x.com' || hostname === 'twitter.com') {
    return 'Xbrand';
  }
  if (hostname?.includes('linkedin')) {
    return 'LinkedinBrand';
  }
  if (hostname === 't.me' || hostname?.includes('telegram')) {
    return 'TelegramBrand';
  }

  return 'GlobusOutline';
}

function getLinkTitle({
  link,
  intl,
}: {
  link: IEarnProtocolIntroSocialLink;
  intl: ReturnType<typeof useIntl>;
}) {
  if (hasText(link.title)) {
    return getText(link.title);
  }

  const type = link.type?.toLowerCase();
  const iconName = getLinkIcon(link);
  if (type === 'website') {
    return intl.formatMessage({ id: ETranslations.global_website });
  }
  if (type === 'discord') {
    return intl.formatMessage({ id: ETranslations.global_discord });
  }
  if (type === 'twitter' || type === 'x') {
    return 'X';
  }
  if (type === 'linkedin') {
    return 'LinkedIn';
  }
  if (type === 'telegram') {
    return 'Telegram';
  }

  if (type === 'link') {
    if (iconName === 'GlobusOutline') {
      return intl.formatMessage({ id: ETranslations.global_website });
    }
    if (iconName === 'DiscordBrand') {
      return intl.formatMessage({ id: ETranslations.global_discord });
    }
    if (iconName === 'Xbrand') {
      return 'X';
    }
    if (iconName === 'LinkedinBrand') {
      return 'LinkedIn';
    }
    if (iconName === 'TelegramBrand') {
      return 'Telegram';
    }
  }

  return getHostname(getLinkUrl(link));
}

function hasProtocolIntroItemContent(item: IEarnProtocolIntroItem) {
  return Boolean(
    hasText(getItemTitle(item)) ||
    hasText(item.name) ||
    hasText(item.description) ||
    item.tags?.some((tag) => hasText(getTagText(tag))) ||
    item.metrics?.some((metric) => hasText(getMetricValue(metric))) ||
    item.stats?.some((metric) => hasText(getMetricValue(metric))) ||
    hasText(item.tvl) ||
    hasText(item.fdv) ||
    hasText(item.establishment) ||
    hasText(item.establishmentDate) ||
    item.socialLinks?.some((link) => Boolean(getLinkUrl(link))) ||
    item.links?.some((link) => Boolean(getLinkUrl(link))) ||
    item.team?.items?.length ||
    item.team?.button?.data?.members?.length ||
    item.teamMembers?.items?.length ||
    item.teamMembers?.button?.data?.members?.length ||
    item.investors?.items?.length ||
    item.investors?.button?.data?.fundingRounds?.length ||
    item.audits?.items?.length ||
    item.audits?.button?.data?.auditItems?.length,
  );
}

const DIALOG_CONTENT_MAX_HEIGHT = 512;

function DialogContent({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView maxHeight={DIALOG_CONTENT_MAX_HEIGHT} nestedScrollEnabled>
      <YStack px="$5" pb="$5">
        {children}
      </YStack>
    </ScrollView>
  );
}

function ProtocolLogo({
  item,
  size = 40,
  borderRadius = '$2',
}: {
  item: Pick<
    IEarnProtocolIntroItem,
    | 'logoURI'
    | 'logoUrl'
    | 'logoUri'
    | 'providerLogoURI'
    | 'providerLogoUrl'
    | 'providerLogoUri'
    | 'icon'
    | 'type'
    | 'provider'
    | 'slug'
    | 'title'
    | 'displayName'
    | 'name'
  >;
  size?: number;
  borderRadius?: '$1' | '$2' | '$full';
}) {
  const logoURI = getProtocolLogoURI(item);
  if (logoURI) {
    return (
      <Image w={size} h={size} borderRadius={borderRadius} src={logoURI} />
    );
  }

  return item.icon ? (
    <XStack w={size} h={size} ai="center" jc="center">
      <EarnIcon icon={item.icon} size={size} />
    </XStack>
  ) : (
    <XStack
      w={size}
      h={size}
      borderRadius={borderRadius}
      bg="$bgStrong"
      ai="center"
      jc="center"
      flexShrink={0}
    >
      <Icon
        name={
          item.type === 'complex_earn' ||
          item.type === 'nested_earn' ||
          item.provider === 'pendle' ||
          item.slug === 'pendle'
            ? 'ChartTrendingUpOutline'
            : 'CubeOutline'
        }
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  );
}

const DESCRIPTION_LINE_HEIGHT = 20;
const DESCRIPTION_MAX_LINES = 3;
const DESCRIPTION_PENDING_MEASURE_MAX_CHARS = 132;

function getCollapsedDescriptionText(description: string, target: number) {
  let cut = description.slice(0, target);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > target * 0.6) {
    cut = cut.slice(0, lastSpace);
  }
  return cut.trimEnd();
}

function ExpandableDescription({ text }: { text: IEarnProtocolIntroText }) {
  const intl = useIntl();
  const description = getText(text) || '';
  const color = toEarnText(text)?.color || '$textSubdued';
  const [measurement, setMeasurement] = useState({
    description,
    expanded: false,
    fullHeight: 0,
  });

  if (measurement.description !== description) {
    setMeasurement({
      description,
      expanded: false,
      fullHeight: 0,
    });
  }

  const expanded =
    measurement.description === description ? measurement.expanded : false;
  const fullHeight =
    measurement.description === description ? measurement.fullHeight : 0;

  const handleMeasureLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const next = event.nativeEvent.layout.height;
      setMeasurement((prev) =>
        prev.description === description && prev.fullHeight !== next
          ? { ...prev, fullHeight: next }
          : prev,
      );
    },
    [description],
  );

  const handleExpand = useCallback(
    () =>
      setMeasurement((prev) =>
        prev.description === description ? { ...prev, expanded: true } : prev,
      ),
    [description],
  );

  const maxVisibleHeight = DESCRIPTION_LINE_HEIGHT * DESCRIPTION_MAX_LINES + 1;
  const hasPendingMeasurement = fullHeight === 0;
  const hasOverflow =
    fullHeight > maxVisibleHeight ||
    (hasPendingMeasurement &&
      description.length > DESCRIPTION_PENDING_MEASURE_MAX_CHARS);

  // Estimate how many characters fit within DESCRIPTION_MAX_LINES, based on
  // the ratio of the visible-line height to the full text height. Height-based
  // measurement works on every platform (unlike onTextLayout, which is not
  // reliable on react-native-web here).
  const truncatedText = useMemo(() => {
    if (!hasOverflow || !fullHeight) {
      return hasOverflow
        ? getCollapsedDescriptionText(
            description,
            DESCRIPTION_PENDING_MEASURE_MAX_CHARS,
          )
        : description;
    }
    const ratio =
      (DESCRIPTION_LINE_HEIGHT * DESCRIPTION_MAX_LINES) / fullHeight;
    // Reserve room for the inline "… more" suffix.
    const buffer = 14;
    const target = Math.max(0, Math.floor(description.length * ratio) - buffer);
    return getCollapsedDescriptionText(description, target);
  }, [description, fullHeight, hasOverflow]);

  if (!description) {
    return null;
  }

  return (
    <YStack position="relative">
      {expanded || !hasOverflow ? (
        <SizableText
          size="$bodyMd"
          lineHeight={DESCRIPTION_LINE_HEIGHT}
          color={color}
        >
          {description}
        </SizableText>
      ) : (
        <SizableText
          size="$bodyMd"
          lineHeight={DESCRIPTION_LINE_HEIGHT}
          color={color}
          numberOfLines={DESCRIPTION_MAX_LINES}
        >
          {`${truncatedText}… `}
          <SizableText
            size="$bodyMd"
            lineHeight={DESCRIPTION_LINE_HEIGHT}
            color={color}
            textDecorationLine="underline"
            cursor="pointer"
            onPress={handleExpand}
          >
            {intl.formatMessage({ id: ETranslations.global_more })}
          </SizableText>
        </SizableText>
      )}
      <YStack
        position="absolute"
        opacity={0}
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        left={0}
        right={0}
        top={0}
        onLayout={handleMeasureLayout}
      >
        <SizableText
          size="$bodyMd"
          lineHeight={DESCRIPTION_LINE_HEIGHT}
          color={color}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {description}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function SocialLinkButton({ link }: { link: IEarnProtocolIntroSocialLink }) {
  const intl = useIntl();
  const title = getLinkTitle({ link, intl });
  const url = getLinkUrl(link);

  const handlePress = useCallback(() => {
    if (url) {
      openUrlExternal(url);
    }
  }, [url]);

  if (!url || !title || link.disabled) {
    return null;
  }

  return (
    <Button
      testID={EarnTestIDs.protocolIntroLinkButton(title)}
      size="medium"
      variant="tertiary"
      borderRadius="$full"
      icon={getLinkIcon(link)}
      onPress={handlePress}
    >
      {title}
    </Button>
  );
}

function ProtocolTitle({ item }: { item: IEarnProtocolIntroItem }) {
  const title = getItemTitle(item);

  return (
    <XStack gap="$2.5" ai="center" w="100%" minWidth={0}>
      <ProtocolLogo item={item} size={24} borderRadius="$1" />
      <EarnText
        text={toEarnText(title)}
        size="$headingLg"
        color="$text"
        numberOfLines={1}
      />
    </XStack>
  );
}

function ProtocolTabItem({
  item,
  selected,
  onPress,
}: {
  item: IEarnProtocolIntroItem;
  selected: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item, intl);

  return (
    <XStack
      h={50}
      gap="$3"
      ai="center"
      py="$1.5"
      pl="$3"
      pr="$5"
      borderRadius="$3"
      bg={selected ? '$bgActive' : '$bgSubdued'}
      cursor="pointer"
      flexShrink={0}
      onPress={onPress}
    >
      <ProtocolLogo item={item} size={28} borderRadius="$1" />
      <YStack gap="$0.5" minWidth={0}>
        <EarnText
          text={toEarnText(title)}
          size="$bodyMdMedium"
          color={selected ? '$text' : '$textSubdued'}
          numberOfLines={1}
        />
        {hasText(subtitle) ? (
          <EarnText
            text={toEarnText(subtitle)}
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
          />
        ) : null}
      </YStack>
    </XStack>
  );
}

function ProtocolTabs({
  items,
  selectedIndex,
  onChange,
}: {
  items: IEarnProtocolIntroItem[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) {
  if (items.length <= 1) {
    const item = items[0];
    return item ? <ProtocolTitle item={item} /> : null;
  }

  return (
    <XStack gap="$2" flexWrap="wrap">
      {items.map((item, index) => {
        const selected = selectedIndex === index;
        const title = getItemTitle(item);
        return (
          <ProtocolTabItem
            key={`${getText(title) || item.provider || item.slug || 'provider'}-${index}`}
            item={item}
            selected={selected}
            onPress={() => onChange(index)}
          />
        );
      })}
    </XStack>
  );
}

function DescriptionBlock({ item }: { item: IEarnProtocolIntroItem }) {
  const tags = useMemo(
    () => (item.tags ?? []).map(getTagText).filter(hasText),
    [item.tags],
  );

  if (!hasText(item.description) && !tags.length) {
    return null;
  }

  return (
    <YStack gap="$3">
      {hasText(item.description) ? (
        <ExpandableDescription
          text={item.description as IEarnProtocolIntroText}
        />
      ) : null}
      {tags.length ? (
        <XStack gap="$2" flexWrap="wrap">
          {tags.map((tag, index) => (
            <XStack
              key={`${getText(tag) || 'tag'}-${index}`}
              minWidth="$9"
              px="$2"
              py="$0.5"
              borderRadius="$1"
              bg="$bgStrong"
              jc="center"
            >
              <EarnText
                text={toEarnText(tag)}
                size="$bodySmMedium"
                color="$textSubdued"
              />
            </XStack>
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}

function MetricCell({ metric }: { metric: IEarnProtocolIntroMetric }) {
  return (
    <YStack flexBasis="50%" $gtMd={{ flexBasis: '33.33%' }} pr="$2" gap="$1.5">
      <EarnText
        text={toEarnText(metric.title)}
        size="$bodyMd"
        color="$textSubdued"
      />
      <EarnText
        text={toEarnText(getMetricValue(metric))}
        size="$bodyLgMedium"
        color="$text"
      />
    </YStack>
  );
}

function useVisibleMetrics(item: IEarnProtocolIntroItem) {
  const intl = useIntl();
  const metrics = useMemo(() => {
    if (item.metrics?.length) {
      return item.metrics;
    }

    if (item.stats?.length) {
      return item.stats.map((stat) => ({
        ...stat,
        value: getMetricValue(stat),
      }));
    }

    return [
      hasText(item.tvl)
        ? {
            title: intl.formatMessage({ id: ETranslations.earn_tvl }),
            value: item.tvl,
          }
        : undefined,
      hasText(item.fdv)
        ? {
            title: intl.formatMessage({ id: ETranslations.global_fdv }),
            value: item.fdv,
          }
        : undefined,
      hasText(item.establishment) || hasText(item.establishmentDate)
        ? {
            title: intl.formatMessage({ id: ETranslations.global_date }),
            value: item.establishment || item.establishmentDate,
          }
        : undefined,
    ].filter(Boolean) as IEarnProtocolIntroMetric[];
  }, [intl, item]);

  return metrics.filter((metric) => hasText(getMetricValue(metric)));
}

function getMemberName(member?: IEarnProtocolIntroTeamMember) {
  return member?.name || member?.title;
}

function getMemberPosition(member?: IEarnProtocolIntroTeamMember) {
  return member?.position || member?.role;
}

function getMemberDescription(member?: IEarnProtocolIntroTeamMember) {
  return member?.description;
}

function getMemberAvatar(member?: IEarnProtocolIntroTeamMember) {
  return member?.avatarUrl || member?.avatar || member?.logoURI;
}

function getMemberLinks(member: IEarnProtocolIntroTeamMember) {
  return getVisibleLinks(member.socialLinks, member.links);
}

function getTeamMembers(team?: IEarnProtocolIntroTeam) {
  return team?.button?.data?.members?.length
    ? team.button.data.members
    : team?.items || [];
}

function getInvestorRounds(investors?: IEarnProtocolIntroInvestors) {
  return investors?.button?.data?.fundingRounds?.length
    ? investors.button.data.fundingRounds
    : investors?.items || [];
}

function getAudits(audits?: IEarnProtocolIntroAudits) {
  return audits?.button?.data?.auditItems?.length
    ? audits.button.data.auditItems
    : audits?.items || [];
}

function addProtocolIntroImageUrl(urls: Set<string>, url?: string | null) {
  const safeUrl = getSafeExternalUrl(url);
  if (safeUrl) {
    urls.add(safeUrl);
  }
}

function collectProtocolIntroImageUrls(
  item: IEarnProtocolIntroItem,
  urls: Set<string>,
) {
  addProtocolIntroImageUrl(urls, getProtocolLogoURI(item));

  [item.team, item.teamMembers].forEach((team) => {
    getTeamMembers(team).forEach((member) => {
      addProtocolIntroImageUrl(urls, getMemberAvatar(member));
    });
  });

  getAudits(item.audits).forEach((audit) => {
    addProtocolIntroImageUrl(urls, audit.auditorLogoUrl || audit.logoURI);
  });
}

function getInvestorTitle(round?: IEarnProtocolIntroInvestorRound) {
  return round?.title || round?.investors || round?.round;
}

function getAuditTitle(audit?: IEarnProtocolIntroAudit) {
  return audit?.title || audit?.name || audit?.auditor;
}

function getAuditScope(audit?: IEarnProtocolIntroAudit) {
  return audit?.scope || audit?.description;
}

function FallbackAvatar({ size = 24 }: { size?: number }) {
  return (
    <XStack w={size} h={size} ai="center" jc="center" flexShrink={0}>
      <Icon name="UserAvatarFallbackColored" width={size} height={size} />
    </XStack>
  );
}

function MemberAvatar({ member }: { member: IEarnProtocolIntroTeamMember }) {
  const avatar = getMemberAvatar(member);
  if (avatar) {
    return (
      <Image w={24} h={24} borderRadius="$full" src={avatar} flexShrink={0} />
    );
  }
  return <FallbackAvatar />;
}

function MemberSocialIcon({ link }: { link: IEarnProtocolIntroSocialLink }) {
  const url = getLinkUrl(link);
  const handlePress = useCallback(() => {
    if (url) {
      openUrlExternal(url);
    }
  }, [url]);

  if (!url || link.disabled) {
    return null;
  }

  return (
    <XStack
      w={20}
      h={20}
      ai="center"
      jc="center"
      cursor="pointer"
      onPress={handlePress}
    >
      <Icon name={getLinkIcon(link)} size="$5" color="$iconSubdued" />
    </XStack>
  );
}

function TeamMemberRow({ member }: { member: IEarnProtocolIntroTeamMember }) {
  const name = getMemberName(member);
  const position = getMemberPosition(member);
  const description = getMemberDescription(member);
  const links = getMemberLinks(member);

  return (
    <YStack gap="$2" w="100%">
      <XStack gap="$3" ai="center" minWidth={0}>
        <MemberAvatar member={member} />
        <YStack flex={1} minWidth={0} pr="$1" jc="center">
          <XStack gap="$2" ai="center" minWidth={0}>
            <EarnText
              text={toEarnText(name)}
              size="$bodyLgMedium"
              color="$text"
              flex={1}
              minWidth={0}
              numberOfLines={1}
            />
            {links.length ? (
              <XStack ai="center" gap="$2" flexShrink={0}>
                {links.map((link, index) => (
                  <MemberSocialIcon
                    key={`${getLinkUrl(link) || link.type || 'link'}-${index}`}
                    link={link}
                  />
                ))}
              </XStack>
            ) : null}
          </XStack>
          {hasText(position) ? (
            <EarnText
              text={toEarnText(position)}
              size="$bodyMdMedium"
              color="$textSubdued"
            />
          ) : null}
        </YStack>
      </XStack>
      {hasText(description) ? (
        <XStack pl={36} minWidth={0}>
          <EarnText
            text={toEarnText(description)}
            size="$bodyMd"
            color="$textSubdued"
            flex={1}
            minWidth={0}
          />
        </XStack>
      ) : null}
    </YStack>
  );
}

function InvestorMetricCell({
  title,
  value,
}: {
  title?: IEarnProtocolIntroText;
  value?: IEarnProtocolIntroText;
}) {
  if (!hasText(value)) {
    return null;
  }

  return (
    <YStack flex={1} minWidth={0} gap="$0.5">
      <EarnText text={toEarnText(title)} size="$bodySm" color="$textSubdued" />
      <EarnText
        text={toEarnText(value)}
        size="$bodyMd"
        color="$text"
        numberOfLines={1}
      />
    </YStack>
  );
}

function getInvestorMetricCells(
  round: IEarnProtocolIntroInvestorRound,
  intl: ReturnType<typeof useIntl>,
) {
  const metrics = (round.items ?? []).filter((metric) =>
    hasText(getMetricValue(metric)),
  );

  if (metrics.length) {
    return metrics;
  }

  return [
    {
      title: intl.formatMessage({ id: ETranslations.global_date }),
      value: round.date,
    },
    {
      title: intl.formatMessage({ id: ETranslations.content__amount }),
      value: round.amount,
    },
  ].filter((metric) => hasText(metric.value));
}

function InvestorRoundSection({
  round,
  isLast,
  investorsTitle,
}: {
  round: IEarnProtocolIntroInvestorRound;
  isLast: boolean;
  investorsTitle?: IEarnProtocolIntroText;
}) {
  const intl = useIntl();
  const metrics = getInvestorMetricCells(round, intl);

  return (
    <YStack>
      {hasText(round.title || round.round) ? (
        <EarnText
          text={toEarnText(round.title || round.round)}
          size="$headingSm"
          color="$text"
          mb="$3"
        />
      ) : null}
      {metrics.length ? (
        <XStack gap="$3" mb="$3">
          {metrics.map((metric, metricIndex) => (
            <InvestorMetricCell
              key={`${getText(metric.title) || 'metric'}-${metricIndex}`}
              title={metric.title}
              value={getMetricValue(metric)}
            />
          ))}
        </XStack>
      ) : null}
      {hasText(round.investors) ? (
        <YStack gap="$0.5" mb={isLast ? '$3' : '$5'}>
          {hasText(investorsTitle) ? (
            <EarnText
              text={toEarnText(investorsTitle)}
              size="$bodySm"
              color="$textSubdued"
            />
          ) : null}
          <EarnText
            text={toEarnText(round.investors)}
            size="$bodyMd"
            color="$text"
          />
        </YStack>
      ) : null}
      {isLast ? null : <Divider mb="$5" />}
    </YStack>
  );
}

function PreviewCountBadge({ count }: { count: number }) {
  if (count <= 1) {
    return null;
  }
  return (
    <XStack
      px="$1.5"
      py="$0.5"
      borderRadius="$full"
      bg="$bgStrong"
      ai="center"
      jc="center"
    >
      <SizableText size="$bodySmMedium" color="$textSubdued">
        +{count - 1}
      </SizableText>
    </XStack>
  );
}

function AuditFallbackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10Z"
        fill="black"
        fillOpacity={0.447}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.7507 4.75V13.5H12.334V7.08333H15.2507V13.5H16.4173V14.6667H3.58398V13.5H4.75065V4.75H11.7507ZM7.08398 11.1667H9.41732V10H7.08398V11.1667ZM7.08398 8.83333H9.41732V7.66667H7.08398V8.83333Z"
        fill="white"
      />
    </Svg>
  );
}

function PreviewCellIcon({
  imageUrl,
  fallbackIcon,
  fallbackAuditIcon,
}: {
  imageUrl?: string | null;
  fallbackIcon?: IKeyOfIcons;
  fallbackAuditIcon?: boolean;
}) {
  if (imageUrl) {
    return (
      <Image w={20} h={20} borderRadius="$full" src={imageUrl} flexShrink={0} />
    );
  }

  if (fallbackAuditIcon) {
    return (
      <XStack w={20} h={20} ai="center" jc="center" flexShrink={0}>
        <AuditFallbackIcon />
      </XStack>
    );
  }

  if (fallbackIcon) {
    return (
      <XStack w={20} h={20} ai="center" jc="center" flexShrink={0}>
        <Icon name={fallbackIcon} width={20} height={20} />
      </XStack>
    );
  }

  return null;
}

function PreviewCell({
  title,
  value,
  count,
  imageUrl,
  fallbackIcon,
  fallbackAuditIcon,
  onPress,
}: {
  title?: IEarnProtocolIntroText;
  value?: IEarnProtocolIntroText;
  count: number;
  imageUrl?: string | null;
  fallbackIcon?: IKeyOfIcons;
  fallbackAuditIcon?: boolean;
  onPress: () => void;
}) {
  if (!hasText(title) || !hasText(value)) {
    return null;
  }

  return (
    <YStack flexBasis="50%" $gtMd={{ flexBasis: '33.33%' }} pr="$2" gap="$1.5">
      <EarnText text={toEarnText(title)} size="$bodyMd" color="$textSubdued" />
      <XStack
        ai="center"
        gap="$2"
        minWidth={0}
        cursor="pointer"
        onPress={onPress}
      >
        <PreviewCellIcon
          imageUrl={imageUrl}
          fallbackIcon={fallbackIcon}
          fallbackAuditIcon={fallbackAuditIcon}
        />
        <EarnText
          text={toEarnText(value)}
          size="$bodyLgMedium"
          color="$text"
          flexShrink={1}
          minWidth={0}
          numberOfLines={1}
        />
        <PreviewCountBadge count={count} />
      </XStack>
    </YStack>
  );
}

function ProtocolFactsGrid({
  item,
  team,
  investors,
  audits,
  onShowTeam,
  onShowInvestors,
  onShowAudits,
}: {
  item: IEarnProtocolIntroItem;
  team?: IEarnProtocolIntroTeam;
  investors?: IEarnProtocolIntroInvestors;
  audits?: IEarnProtocolIntroAudits;
  onShowTeam: () => void;
  onShowInvestors: () => void;
  onShowAudits: () => void;
}) {
  const visibleMetrics = useVisibleMetrics(item);

  const teamMembers = getTeamMembers(team).filter((member) =>
    hasText(getMemberName(member)),
  );
  const teamPreview = team?.items?.find((member) =>
    hasText(getMemberName(member)),
  );
  const investorsRounds = getInvestorRounds(investors).filter((round) =>
    hasText(getInvestorTitle(round)),
  );
  const investorPreview = investors?.items?.find((round) =>
    hasText(getInvestorTitle(round)),
  );
  const auditItems = getAudits(audits).filter((audit) =>
    hasText(getAuditTitle(audit)),
  );
  const auditPreview = audits?.items?.find((audit) =>
    hasText(getAuditTitle(audit)),
  );
  const firstTeamMember = teamPreview || teamMembers[0];
  const firstInvestorRound = investorPreview || investorsRounds[0];
  const firstAudit = auditPreview || auditItems[0];

  if (
    !visibleMetrics.length &&
    !teamMembers.length &&
    !investorsRounds.length &&
    !auditItems.length
  ) {
    return null;
  }

  return (
    <XStack flexWrap="wrap" py="$3" rowGap="$6">
      {visibleMetrics.map((metric, index) => (
        <MetricCell
          key={`${getText(metric.title) || getText(metric.value)}-${index}`}
          metric={metric}
        />
      ))}
      <PreviewCell
        title={team?.title || team?.button?.data?.title}
        value={getMemberName(firstTeamMember)}
        imageUrl={getMemberAvatar(firstTeamMember)}
        fallbackIcon="UserAvatarFallbackColored"
        count={teamMembers.length || (team?.items?.length ?? 0)}
        onPress={onShowTeam}
      />
      <PreviewCell
        title={investors?.title || investors?.button?.data?.title}
        value={getInvestorTitle(firstInvestorRound)}
        count={investorsRounds.length || (investors?.items?.length ?? 0)}
        onPress={onShowInvestors}
      />
      <PreviewCell
        title={audits?.title || audits?.button?.data?.title}
        value={getAuditTitle(firstAudit)}
        imageUrl={firstAudit?.auditorLogoUrl || firstAudit?.logoURI}
        fallbackAuditIcon
        count={auditItems.length || (audits?.items?.length ?? 0)}
        onPress={onShowAudits}
      />
    </XStack>
  );
}

function InvestorsDialogContent({
  investors,
}: {
  investors: IEarnProtocolIntroInvestors;
}) {
  const rounds = getInvestorRounds(investors);
  const investorsTitle = investors.title || investors.button?.data?.title;
  return (
    <YStack>
      {rounds.map((round, index) => (
        <InvestorRoundSection
          key={`${getText(getInvestorTitle(round)) || 'round'}-${index}`}
          round={round}
          isLast={index === rounds.length - 1}
          investorsTitle={investorsTitle}
        />
      ))}
    </YStack>
  );
}

function AuditLogo({ audit }: { audit: IEarnProtocolIntroAudit }) {
  const logoURI = audit.auditorLogoUrl || audit.logoURI;

  if (logoURI) {
    return (
      <Image w="$5" h="$5" borderRadius="$full" src={logoURI} flexShrink={0} />
    );
  }

  return (
    <XStack w="$5" h="$5" ai="center" jc="center" flexShrink={0}>
      <AuditFallbackIcon />
    </XStack>
  );
}

function AuditAccordionItem({
  audit,
  index,
}: {
  audit: IEarnProtocolIntroAudit;
  index: number;
}) {
  const intl = useIntl();
  const url = getLinkUrl(audit.button) || getSafeExternalUrl(audit.url);
  const scope = getAuditScope(audit);
  const hasContent = hasText(scope) || Boolean(url);
  const handleOpen = useCallback(() => {
    if (url) {
      openUrlExternal(url);
    }
  }, [url]);

  return (
    <Accordion.Item value={String(index)}>
      <Accordion.Trigger
        unstyled
        flexDirection="row"
        alignItems="center"
        borderWidth={0}
        bg="$transparent"
        px="$2"
        py="$2"
        mx="$-2"
        my="$-2"
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
      >
        {({ open }: { open: boolean }) => (
          <>
            <XStack
              width={AUDIT_NAME_COLUMN_WIDTH}
              flexShrink={0}
              minWidth={0}
              gap="$1.5"
              ai="center"
            >
              <AuditLogo audit={audit} />
              <EarnText
                text={toEarnText(getAuditTitle(audit))}
                size="$bodyMdMedium"
                color="$text"
                flexShrink={1}
                minWidth={0}
                numberOfLines={1}
              />
            </XStack>
            <EarnText
              text={toEarnText(audit.date)}
              size="$bodyMd"
              color="$textSubdued"
              flex={1}
              minWidth={0}
              numberOfLines={1}
              textAlign="left"
            />
            <XStack w="$5" flexShrink={0} minWidth={0} jc="flex-end">
              <Stack
                animation="quick"
                animateOnly={ANIMATE_ONLY_TRANSFORM}
                rotate={open ? '180deg' : '0deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  color={open ? '$iconActive' : '$iconSubdued'}
                  size="$5"
                />
              </Stack>
            </XStack>
          </>
        )}
      </Accordion.Trigger>
      {hasContent ? (
        <Accordion.HeightAnimator animation="quick">
          <Accordion.Content
            unstyled
            pt="$3"
            pb="$4"
            animation="100ms"
            animateOnly={ANIMATE_ONLY_OPACITY}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          >
            <XStack gap="$3" ai="flex-start">
              {hasText(scope) ? (
                <EarnText
                  text={toEarnText(scope)}
                  size="$bodyMd"
                  color="$text"
                  flex={1}
                />
              ) : (
                <YStack flex={1} />
              )}
              {url ? (
                <Button
                  testID={EarnTestIDs.protocolIntroAuditButton(
                    getText(audit.button?.title) || '',
                  )}
                  size="small"
                  variant="secondary"
                  borderRadius="$full"
                  onPress={handleOpen}
                >
                  {getText(audit.button?.title) ||
                    intl.formatMessage({ id: ETranslations.global_view })}
                </Button>
              ) : null}
            </XStack>
          </Accordion.Content>
        </Accordion.HeightAnimator>
      ) : null}
    </Accordion.Item>
  );
}

function AuditsDialogContent({ audits }: { audits: IEarnProtocolIntroAudits }) {
  const intl = useIntl();
  const auditItems = getAudits(audits);
  const descriptions = audits.button?.data?.description;
  return (
    <YStack gap="$4">
      <Accordion type="single" collapsible gap="$4" pt="$2">
        {auditItems.map((audit, index) => (
          <AuditAccordionItem
            key={`${getText(getAuditTitle(audit)) || 'audit'}-${index}`}
            audit={audit}
            index={index}
          />
        ))}
      </Accordion>
      {descriptions?.map((description, index) => (
        <EarnText
          key={`${getText(description) || 'description'}-${index}`}
          text={toEarnText(description)}
          size="$bodySm"
          color="$textSubdued"
        />
      ))}
      {hasText(audits.updatedAt) ? (
        <EarnText
          text={{
            text: `${intl.formatMessage({
              id: ETranslations.market_last_updated,
            })} ${getText(audits.updatedAt) || ''}`.trim(),
          }}
          size="$bodySm"
          color="$textSubdued"
        />
      ) : null}
    </YStack>
  );
}

function ProtocolIntroSectionComponent({
  protocolInfo,
}: {
  protocolInfo?: IEarnProtocolIntroInfo | IEarnProtocolIntroItem[];
}) {
  const intl = useIntl();
  const [selection, setSelection] = useState<{
    protocolInfo?: IEarnProtocolIntroInfo | IEarnProtocolIntroItem[];
    index: number;
  }>({ protocolInfo, index: 0 });

  const protocolItems = useMemo(() => {
    const items = Array.isArray(protocolInfo)
      ? protocolInfo
      : protocolInfo?.items;
    return (items ?? []).filter(hasProtocolIntroItemContent);
  }, [protocolInfo]);
  const imageUrls = useMemo(() => {
    const urls = new Set<string>();
    protocolItems.forEach((item) => collectProtocolIntroImageUrls(item, urls));
    return Array.from(urls);
  }, [protocolItems]);

  useEffect(() => {
    if (!imageUrls.length) {
      return;
    }
    void Image.preloadImages(imageUrls.map((uri) => ({ uri }))).catch(
      () => undefined,
    );
  }, [imageUrls]);

  const selectedIndex =
    selection.protocolInfo === protocolInfo &&
    selection.index >= 0 &&
    selection.index < protocolItems.length
      ? selection.index
      : 0;
  const selectedItem = protocolItems[selectedIndex] ?? protocolItems[0];
  const team = selectedItem?.teamMembers || selectedItem?.team;
  const investors = selectedItem?.investors;
  const audits = selectedItem?.audits;
  const visibleSocialLinks = getVisibleLinks(
    selectedItem?.socialLinks,
    selectedItem?.links,
  );

  const handleSelectProtocol = useCallback(
    (index: number) => {
      setSelection({ protocolInfo, index });
    },
    [protocolInfo],
  );

  const showDialog = useCallback(
    ({
      title,
      renderContent,
    }: {
      title?: IEarnProtocolIntroText;
      renderContent: React.ReactNode;
    }) => {
      Dialog.show({
        title: getText(title),
        contentContainerProps: {
          px: '$0',
          pb: '$0',
        },
        floatingPanelProps: {
          width: 400,
        },
        renderContent: <DialogContent>{renderContent}</DialogContent>,
        onConfirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
        confirmButtonProps: {
          variant: 'secondary',
        },
        showCancelButton: false,
      });
    },
    [intl],
  );

  const handleShowTeam = useCallback(() => {
    const members = getTeamMembers(team);
    if (!members.length) {
      return;
    }
    showDialog({
      title: team?.button?.data?.title || team?.title,
      renderContent: (
        <YStack gap="$6">
          {members.map((member, index) => (
            <TeamMemberRow
              key={`${getText(getMemberName(member)) || 'member'}-${index}`}
              member={member}
            />
          ))}
        </YStack>
      ),
    });
  }, [showDialog, team]);

  const handleShowInvestors = useCallback(() => {
    if (!getInvestorRounds(investors).length || !investors) {
      return;
    }
    showDialog({
      title: investors.button?.data?.title || investors.title,
      renderContent: <InvestorsDialogContent investors={investors} />,
    });
  }, [investors, showDialog]);

  const handleShowAudits = useCallback(() => {
    if (!getAudits(audits).length || !audits) {
      return;
    }
    showDialog({
      title: audits.button?.data?.title || audits.title,
      renderContent: <AuditsDialogContent audits={audits} />,
    });
  }, [audits, showDialog]);

  if (!selectedItem || !protocolItems.length) {
    return null;
  }

  return (
    <>
      <YStack gap="$6">
        <ProtocolTabs
          items={protocolItems}
          selectedIndex={selectedIndex}
          onChange={handleSelectProtocol}
        />
        <DescriptionBlock item={selectedItem} />
        <ProtocolFactsGrid
          item={selectedItem}
          team={team}
          investors={investors}
          audits={audits}
          onShowTeam={handleShowTeam}
          onShowInvestors={handleShowInvestors}
          onShowAudits={handleShowAudits}
        />
        {visibleSocialLinks.length ? (
          <XStack
            ai="center"
            columnGap="$4"
            rowGap="$6"
            flexWrap="wrap"
            py="$2"
          >
            {visibleSocialLinks.map((link, index) => (
              <Fragment
                key={`${getLinkUrl(link) || link.type || 'social'}-${index}`}
              >
                {index > 0 ? (
                  <Divider vertical h={20} borderColor="$border" />
                ) : null}
                <SocialLinkButton link={link} />
              </Fragment>
            ))}
          </XStack>
        ) : null}
        {hasText(
          Array.isArray(protocolInfo) ? undefined : protocolInfo?.notice,
        ) ? (
          <EarnText
            text={toEarnText(
              Array.isArray(protocolInfo) ? undefined : protocolInfo?.notice,
            )}
            size="$bodyMd"
            color="$textSubdued"
          />
        ) : null}
      </YStack>
      <Divider />
    </>
  );
}

export const ProtocolIntroSection = memo(ProtocolIntroSectionComponent);
