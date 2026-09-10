import { type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'

/**
 * The frame every intent screen renders inside. Each screen owns its own
 * header, which is why the navigator's is hidden.
 */
export function ScreenShell({
  title,
  description,
  onBack,
  // Opt out of the default ScrollView for a screen that owns its scrolling,
  // or for one whose gesture must not compete with an ancestor scroll view.
  // A vertical drag inside this ScrollView is exactly the coexistence case
  // `deferTo` exists for, so a screen demonstrating it should set `fill`.
  fill,
  children,
}: {
  title: string
  description?: string
  onBack: () => void
  fill?: boolean
  children: ReactNode
}) {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.backLabel}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      {fill ? (
        <View style={styles.fillContent}>{children}</View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  backLabel: {
    fontSize: 16,
    color: '#6b4fbb',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 24,
  },
  fillContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
})
