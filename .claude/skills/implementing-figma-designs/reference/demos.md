# Component Demos Reference

This file contains usage demos for each component, extracted from the Gallery stories.

## Primitives

### Button

**Source**: `packages/components/src/primitives/Button/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Button.tsx`

```tsx
import { Button, Stack, XStack, YStack } from '@onekeyhq/components';

// Variants
<Button>Secondary (default)</Button>
<Button variant="primary">Primary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="tertiary">Tertiary</Button>

// Sizes
<Button size="small">Small</Button>
<Button size="medium">Medium</Button>
<Button size="large">Large</Button>

// With Icons
<Button icon="PlaceholderOutline">With Icon</Button>
<Button iconAfter="ArrowRightOutline">Icon After</Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading</Button>
<Button textEllipsis>Long text with ellipsis...</Button>
```

### Icon

**Source**: `packages/components/src/primitives/Icon/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Icon.tsx`

```tsx
import { Icon } from '@onekeyhq/components';

<Icon name="SearchOutline" />
<Icon name="SearchOutline" size="$4" />
<Icon name="SearchOutline" size="$6" color="$iconSubdued" />
```

### Image

**Source**: `packages/components/src/primitives/Image/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Image.tsx`

```tsx
import { Icon, Image } from '@onekeyhq/components';

<Image
  size="$10"
  borderRadius="$2"
  source={{ uri: 'https://example.com/image.png' }}
  fallback={
    <Image.Fallback bg="$bgStrong" alignItems="center" justifyContent="center">
      <Icon name="Image2MountainsSolid" color="$iconSubdued" size="$10" />
    </Image.Fallback>
  }
/>
```

### Skeleton

**Source**: `packages/components/src/primitives/Skeleton/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Skeleton.tsx`

```tsx
import { Skeleton, Stack } from '@onekeyhq/components';

<Skeleton w="$20" h="$4" />
<Skeleton w="$40" h="$6" />
<Skeleton w="$full" h="$10" />
```

### Anchor

**Source**: `packages/components/src/primitives/Anchor/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Anchor.tsx`

```tsx
import { Anchor } from '@onekeyhq/components';

<Anchor href="https://onekey.so" target="_blank">
  Visit OneKey
</Anchor>
```

---

## Forms

### Input

**Source**: `packages/components/src/forms/Input/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Input.tsx`

```tsx
import { Input, Stack } from '@onekeyhq/components';

// Sizes
<Input size="small" placeholder="Small" />
<Input size="medium" placeholder="Medium" />
<Input size="large" placeholder="Large" />

// With Icon
<Input leftIconName="SearchOutline" placeholder="Search..." />

// With Actions
<Input
  placeholder="Password"
  addOns={[
    {
      iconName: 'EyeOutline',
      onPress: () => console.log('toggle'),
    },
  ]}
/>

// Secure text entry
<Input placeholder="Password" allowSecureTextEye />

// With label action
<Input
  placeholder="Address"
  addOns={[{ label: 'Paste', onPress: () => console.log('paste') }]}
/>

// States
<Input disabled placeholder="Disabled" />
<Input editable={false} value="Readonly" />
<Input error placeholder="Error state" />
```

### TextArea

**Source**: `packages/components/src/forms/TextArea/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/TextArea.tsx`

```tsx
import { TextArea } from '@onekeyhq/components';

<TextArea placeholder="Enter description..." />
<TextArea numberOfLines={4} placeholder="Multi-line input" />
```

### Select

**Source**: `packages/components/src/forms/Select/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Select.tsx`

```tsx
import { Select } from '@onekeyhq/components';

<Select
  title="Select Option"
  value={selected}
  onChange={setSelected}
  items={[
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
  ]}
/>
```

### Checkbox

**Source**: `packages/components/src/forms/Checkbox/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Checkbox.tsx`

```tsx
import { Checkbox, Stack } from '@onekeyhq/components';

<Checkbox value={checked} onChange={setChecked} label="Accept terms" />
<Checkbox disabled label="Disabled checkbox" />
```

### Radio

**Source**: `packages/components/src/forms/Radio/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Radio.tsx`

```tsx
import { Radio, Stack } from '@onekeyhq/components';

<Radio.Group value={selected} onChange={setSelected}>
  <Radio value="option1" label="Option 1" />
  <Radio value="option2" label="Option 2" />
  <Radio value="option3" label="Option 3" />
</Radio.Group>
```

### Switch

**Source**: `packages/components/src/forms/Switch/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Switch.tsx`

```tsx
import { Switch, XStack, SizableText } from '@onekeyhq/components';

<XStack alignItems="center" gap="$2">
  <Switch value={enabled} onChange={setEnabled} />
  <SizableText>Enable feature</SizableText>
</XStack>
```

### Slider

**Source**: `packages/components/src/forms/Slider/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Slider.tsx`

```tsx
import { Slider, Stack } from '@onekeyhq/components';

<Slider
  value={value}
  onChange={setValue}
  min={0}
  max={100}
  step={1}
/>
```

### Form

**Source**: `packages/components/src/forms/Form/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Form.tsx`

```tsx
import { Form, Input, Button, Stack } from '@onekeyhq/components';

<Form>
  <Form.Field name="email" label="Email">
    <Input placeholder="Enter email" />
  </Form.Field>
  <Form.Field name="password" label="Password">
    <Input placeholder="Enter password" secureTextEntry />
  </Form.Field>
  <Button variant="primary">Submit</Button>
</Form>
```

### OTPInput

**Source**: `packages/components/src/forms/OTPInput/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/OTPInputGallery.tsx`

```tsx
import { OTPInput } from '@onekeyhq/components';

<OTPInput
  value={code}
  onChange={setCode}
  numberOfDigits={6}
/>
```

---

## Actions

### IconButton

**Source**: `packages/components/src/actions/IconButton/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/IconButton.tsx`

```tsx
import { IconButton, XStack } from '@onekeyhq/components';

<IconButton icon="SearchOutline" onPress={() => {}} />
<IconButton icon="SettingsOutline" variant="secondary" />
<IconButton icon="TrashOutline" variant="destructive" />
```

### ActionList

**Source**: `packages/components/src/actions/ActionList/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/ActionList.tsx`

```tsx
import { ActionList } from '@onekeyhq/components';

<ActionList
  title="Actions"
  items={[
    { label: 'Edit', icon: 'PencilOutline', onPress: () => {} },
    { label: 'Copy', icon: 'CopyOutline', onPress: () => {} },
    { label: 'Delete', icon: 'TrashOutline', destructive: true, onPress: () => {} },
  ]}
/>
```

### Alert

**Source**: `packages/components/src/actions/Alert/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Alert.tsx`

```tsx
import { Alert, Stack } from '@onekeyhq/components';

<Alert type="info" title="Information" description="This is an info alert" />
<Alert type="success" title="Success" description="Operation completed" />
<Alert type="warning" title="Warning" description="Please be careful" />
<Alert type="critical" title="Error" description="Something went wrong" />
```

### Toast

**Source**: `packages/components/src/actions/Toast/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Dialog.tsx`

```tsx
import { Toast, Button } from '@onekeyhq/components';

<Button onPress={() => Toast.success({ title: 'Success!' })}>
  Show Toast
</Button>

<Button onPress={() => Toast.error({ title: 'Error occurred' })}>
  Show Error
</Button>

<Button onPress={() => Toast.message({ title: 'Message' })}>
  Show Message
</Button>
```

### Popover

**Source**: `packages/components/src/actions/Popover/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Popover.tsx`

```tsx
import { Popover, Button, Stack, SizableText } from '@onekeyhq/components';

<Popover
  trigger={<Button>Open Popover</Button>}
  renderContent={
    <Stack p="$4">
      <SizableText>Popover content</SizableText>
    </Stack>
  }
/>
```

### SegmentControl

**Source**: `packages/components/src/actions/SegmentControl/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/SegmentControl.tsx`

```tsx
import { SegmentControl } from '@onekeyhq/components';

<SegmentControl
  value={selected}
  onChange={setSelected}
  options={[
    { label: 'Tab 1', value: 'tab1' },
    { label: 'Tab 2', value: 'tab2' },
    { label: 'Tab 3', value: 'tab3' },
  ]}
/>
```

### Pagination

**Source**: `packages/components/src/actions/Pagination/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Pagination.tsx`

```tsx
import { Pagination } from '@onekeyhq/components';

<Pagination
  currentPage={page}
  totalPages={10}
  onPageChange={setPage}
/>
```

---

## Composite

### Dialog

**Source**: `packages/components/src/composite/Dialog/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Dialog.tsx`

```tsx
import { Dialog, Button, Stack, SizableText } from '@onekeyhq/components';

// Using Dialog.show()
<Button
  onPress={() => {
    Dialog.show({
      title: 'Dialog Title',
      description: 'This is a dialog description',
      onConfirm: () => console.log('confirmed'),
      onCancel: () => console.log('cancelled'),
    });
  }}
>
  Open Dialog
</Button>

// Confirm dialog
<Button
  onPress={() => {
    Dialog.confirm({
      title: 'Are you sure?',
      description: 'This action cannot be undone',
      onConfirmText: 'Delete',
      confirmButtonProps: { variant: 'destructive' },
    });
  }}
>
  Delete Item
</Button>
```

### Tabs

**Source**: `packages/components/src/composite/Tabs/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/NewTabsGallery.tsx`

```tsx
import { Tabs, Stack, SizableText } from '@onekeyhq/components';

<Tabs
  value={activeTab}
  onChange={setActiveTab}
>
  <Tabs.Tab title="Tab 1" value="tab1">
    <Stack p="$4">
      <SizableText>Tab 1 content</SizableText>
    </Stack>
  </Tabs.Tab>
  <Tabs.Tab title="Tab 2" value="tab2">
    <Stack p="$4">
      <SizableText>Tab 2 content</SizableText>
    </Stack>
  </Tabs.Tab>
</Tabs>
```

### Banner

**Source**: `packages/components/src/composite/Banner/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Banner/Banner.tsx`

```tsx
import { Banner, Stack } from '@onekeyhq/components';

<Banner
  type="info"
  title="Update Available"
  description="A new version is ready to install"
  actionText="Update Now"
  onAction={() => {}}
/>
```

### Carousel

**Source**: `packages/components/src/composite/Carousel/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Carousel.tsx`

```tsx
import { Carousel, Image, Stack } from '@onekeyhq/components';

<Carousel
  data={images}
  renderItem={({ item }) => (
    <Image source={{ uri: item.uri }} width="100%" height={200} />
  )}
/>
```

### Table

**Source**: `packages/components/src/composite/Table/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/TableGallery/`

```tsx
import { Table } from '@onekeyhq/components';

<Table
  columns={[
    { title: 'Name', dataIndex: 'name' },
    { title: 'Amount', dataIndex: 'amount' },
    { title: 'Status', dataIndex: 'status' },
  ]}
  dataSource={data}
/>
```

### Stepper

**Source**: `packages/components/src/composite/Stepper/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Stepper.tsx`

```tsx
import { Stepper, Stack } from '@onekeyhq/components';

<Stepper
  currentStep={step}
  steps={[
    { title: 'Step 1', description: 'First step' },
    { title: 'Step 2', description: 'Second step' },
    { title: 'Step 3', description: 'Final step' },
  ]}
/>
```

---

## Content

### Badge

**Source**: `packages/components/src/content/Badge/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Badge.tsx`

```tsx
import { Badge, XStack, Icon } from '@onekeyhq/components';

// Badge types
<Badge badgeType="default">Default</Badge>
<Badge badgeType="success">Success</Badge>
<Badge badgeType="info">Info</Badge>
<Badge badgeType="warning">Warning</Badge>
<Badge badgeType="critical">Critical</Badge>

// Badge sizes
<Badge badgeType="success" badgeSize="lg">Large</Badge>
<Badge badgeType="success" badgeSize="sm">Small</Badge>

// Badge with icon
<Badge badgeType="warning" badgeSize="lg" onPress={() => {}}>
  <Badge.Text>Prime</Badge.Text>
  <Icon name="InfoCircleOutline" color="$iconSubdued" size="$5" ml="$1.5" />
</Badge>
```

### Progress

**Source**: `packages/components/src/content/Progress/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Progress.tsx`

```tsx
import { Progress, Stack } from '@onekeyhq/components';

<Progress value={50} />
<Progress value={75} size="lg" />
<Progress value={30} variant="success" />
```

### Empty

**Source**: `packages/components/src/content/Empty/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Empty.tsx`

```tsx
import { Empty, Stack } from '@onekeyhq/components';

<Empty
  icon="InboxOutline"
  title="No Data"
  description="There's nothing here yet"
/>
```

### Divider

**Source**: `packages/components/src/content/Divider/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Divider.tsx`

```tsx
import { Divider, Stack, SizableText } from '@onekeyhq/components';

<Stack>
  <SizableText>Above</SizableText>
  <Divider my="$4" />
  <SizableText>Below</SizableText>
</Stack>
```

### QRCode

**Source**: `packages/components/src/content/QRCode/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/QRCode.tsx`

```tsx
import { QRCode, Stack } from '@onekeyhq/components';

<QRCode value="https://onekey.so" size={200} />
```

### Markdown

**Source**: `packages/components/src/content/Markdown/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Markdown.tsx`

```tsx
import { Markdown } from '@onekeyhq/components';

<Markdown>
  {`# Heading

This is **bold** and *italic* text.

- List item 1
- List item 2
`}
</Markdown>
```

### LottieView

**Source**: `packages/components/src/content/LottieView/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/LottieView.tsx`

```tsx
import { LottieView } from '@onekeyhq/components';

<LottieView
  source={require('./animation.json')}
  autoPlay
  loop
  style={{ width: 200, height: 200 }}
/>
```

### LinearGradient

**Source**: `packages/components/src/content/LinearGradient/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/LinearGradient.tsx`

```tsx
import { LinearGradient, Stack } from '@onekeyhq/components';

<LinearGradient
  colors={['#4c669f', '#3b5998', '#192f6a']}
  style={{ width: 200, height: 200, borderRadius: 10 }}
/>
```

### BlurView

**Source**: `packages/components/src/content/BlurView/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/BlurView.tsx`

```tsx
import { BlurView, Stack } from '@onekeyhq/components';

<BlurView intensity={50} style={{ padding: 20 }}>
  <SizableText>Blurred background</SizableText>
</BlurView>
```

---

## Layouts

### ScrollView

**Source**: `packages/components/src/layouts/ScrollView/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/ScrollView.tsx`

```tsx
import { ScrollView, Stack, SizableText } from '@onekeyhq/components';

<ScrollView>
  <Stack p="$4">
    <SizableText>Scrollable content...</SizableText>
  </Stack>
</ScrollView>
```

### ListView

**Source**: `packages/components/src/layouts/ListView/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/ListView.tsx`

```tsx
import { ListView, Stack, SizableText } from '@onekeyhq/components';

<ListView
  data={items}
  renderItem={({ item }) => (
    <Stack p="$4">
      <SizableText>{item.title}</SizableText>
    </Stack>
  )}
  keyExtractor={(item) => item.id}
/>
```

### SectionList

**Source**: `packages/components/src/layouts/SectionList/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/SectionList.tsx`

```tsx
import { SectionList, Stack, SizableText } from '@onekeyhq/components';

<SectionList
  sections={[
    { title: 'Section 1', data: ['Item 1', 'Item 2'] },
    { title: 'Section 2', data: ['Item 3', 'Item 4'] },
  ]}
  renderItem={({ item }) => (
    <Stack p="$4">
      <SizableText>{item}</SizableText>
    </Stack>
  )}
  renderSectionHeader={({ section }) => (
    <Stack p="$2" bg="$bgSubdued">
      <SizableText size="$headingSm">{section.title}</SizableText>
    </Stack>
  )}
/>
```

### Accordion

**Source**: `packages/components/src/layouts/Accordion/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/AccordionGallery.tsx`

```tsx
import { Accordion, Stack, SizableText } from '@onekeyhq/components';

<Accordion>
  <Accordion.Item value="item1">
    <Accordion.Trigger>
      <SizableText>Section 1</SizableText>
    </Accordion.Trigger>
    <Accordion.Content>
      <Stack p="$4">
        <SizableText>Content for section 1</SizableText>
      </Stack>
    </Accordion.Content>
  </Accordion.Item>
</Accordion>
```

### Swiper

**Source**: `packages/components/src/layouts/Swiper/`
**Demo**: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/Swiper.tsx`

```tsx
import { Swiper, Stack, SizableText } from '@onekeyhq/components';

<Swiper>
  <Swiper.Slide>
    <Stack p="$4" bg="$bgSubdued">
      <SizableText>Slide 1</SizableText>
    </Stack>
  </Swiper.Slide>
  <Swiper.Slide>
    <Stack p="$4" bg="$bgSubdued">
      <SizableText>Slide 2</SizableText>
    </Stack>
  </Swiper.Slide>
</Swiper>
```

---

## Gallery Demo Files Location

All demo files are located in:
`packages/kit/src/views/Developer/pages/Gallery/Components/stories/`

To explore more demos:
```bash
ls packages/kit/src/views/Developer/pages/Gallery/Components/stories/
```
