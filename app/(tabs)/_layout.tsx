import { Tabs } from "expo-router";
import {  FileText, Home, History, Settings, Images, BookA, BookAIcon } from "lucide-react-native";
import React from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const tabBarHeight = 64 + insets.bottom;
  const appContentHeight = Math.max(0, viewportHeight - insets.top - tabBarHeight);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4285F4", 
        tabBarInactiveTintColor: "#9AA0A6",
        headerShown: false,
        sceneStyle: {
          height: appContentHeight,
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E8EAED",
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="translate"
        options={{
          title: "Translate",
          tabBarIcon: ({ color, size }) => <BookAIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: "Gallery",
          tabBarIcon: ({ color, size }) => <Images color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pdf"
        options={{
          title: "PDF",
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}