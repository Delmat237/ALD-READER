import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Radius, Spacing, useAppTheme } from '../../src/theme';

function TabIcon({ emoji, label, focused, colors }: { emoji: string; label: string; focused: boolean, colors: any }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={styles.iconEmoji}>{emoji}</Text>
      {focused && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
    </View>
  );
}

export default function TabLayout() {
  const colors = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.dark, borderTopColor: colors.separator }],
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.white40,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bibliothèque',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📚" label="Bibliothèque" focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="reader"
        options={{
          title: 'Lecture',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎧" label="Lecture" focused={focused} colors={colors} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  iconWrap: {
    alignItems: 'center',
    gap: 3,
  },
  iconEmoji: {
    fontSize: 20,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
