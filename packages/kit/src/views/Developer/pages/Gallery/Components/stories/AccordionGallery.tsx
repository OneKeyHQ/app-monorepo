import {
  Accordion,
  Icon,
  SizableText,
  View,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const AccordionGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Accordion"
    description="A vertically stacked set of interactive headings that each reveal an associated section of content"
    elements={[
      {
        title: 'Multiple',
        element: (
          <YStack gap="$2" alignItems="center">
            <Accordion
              overflow="hidden"
              width="100%"
              type="multiple"
              defaultValue={[]}
            >
              <Accordion.Item value="a1">
                <Accordion.Trigger
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <SizableText>1. Take a cold shower</SizableText>
                      <View
                        animation="quick"
                        rotate={open ? '180deg' : '0deg'}
                        transformOrigin="center"
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color="$iconSubdued"
                          size="$6"
                        />
                      </View>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content
                    animation="quick"
                    exitStyle={{ opacity: 0 }}
                  >
                    <SizableText>
                      Cold showers can help reduce inflammation, relieve pain,
                      improve circulation, lower stress levels, and reduce
                      muscle soreness and fatigue.
                    </SizableText>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>

              <Accordion.Item value="a2">
                <Accordion.Trigger
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <SizableText>2. Eat 4 eggs</SizableText>
                      <View
                        animation="quick"
                        rotate={open ? '180deg' : '0deg'}
                        transformOrigin="center"
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color="$iconSubdued"
                          size="$6"
                        />
                      </View>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content
                    animation="quick"
                    exitStyle={{ opacity: 0 }}
                  >
                    <SizableText>
                      Eggs have been a dietary staple since time immemorial and
                      there’s good reason for their continued presence in our
                      menus and meals.
                    </SizableText>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </Accordion>
          </YStack>
        ),
      },
      {
        title: 'Single',
        element: (
          <YStack gap="$2" alignItems="center">
            <Accordion
              overflow="hidden"
              width="100%"
              type="single"
              collapsible
              defaultValue=""
            >
              <Accordion.Item value="a1">
                <Accordion.Trigger
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <SizableText>1. Take a cold shower</SizableText>
                      <View
                        animation="quick"
                        rotate={open ? '180deg' : '0deg'}
                        transformOrigin="center"
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color="$iconSubdued"
                          size="$6"
                        />
                      </View>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content
                    animation="quick"
                    exitStyle={{ opacity: 0 }}
                  >
                    <SizableText>
                      Cold showers can help reduce inflammation, relieve pain,
                      improve circulation, lower stress levels, and reduce
                      muscle soreness and fatigue.
                    </SizableText>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </Accordion>
          </YStack>
        ),
      },
    ]}
  />
);

export default AccordionGallery;
