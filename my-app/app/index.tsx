import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import CustomButton from "../components/CustomButton";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={["#1A1A1A", "#333333"]}
      style={styles.background}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Gym Tracker</Text>
        <Text style={styles.subtitle}>
          Join the UTM weightlifting community and start tracking your fitness goals!
        </Text>

        <CustomButton
          label="Login"
          onPress={() => router.push("/(auth)/sign-in")}
          color="#FFA500"
        />
        <CustomButton
          label="Sign Up"
          onPress={() => router.push("/(auth)/sign-up")}
          color="#4CAF50"
        />
        <CustomButton
          label="Open App"
          onPress={() => router.push("/(auth)/nav_bar")}
          color="#FFA500"
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#FFF",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: "center",
    color: "#FFF",
  },
});