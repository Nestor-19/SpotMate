import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Platform, Alert, Text, TouchableOpacity } from "react-native";
import { Button, Title, Card } from "react-native-paper";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import apiClient from "@/utils/apiClient";
import { Ionicons } from "@expo/vector-icons";
import type { ApiResponse, Exercise, Workout, WorkoutResponseData } from "@/types/api";
import ExerciseInfoCard from "@/components/ExerciseInfoCard";

function showConfirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  } else {
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Delete", onPress: () => resolve(true), style: "destructive" },
      ]);
    });
  }
}

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function WorkoutInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [duration, setDuration] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchWorkout();
  }, []);

  const fetchWorkout = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse<WorkoutResponseData>>(`/workout/${id}`);
      const fetchedWorkout = response.data.data.workout;
      setWorkout(fetchedWorkout);
      const durationInMinutes = Math.round(
        (new Date(fetchedWorkout.endTime).getTime() - new Date(fetchedWorkout.startTime).getTime()) / 60000
      );
      setDuration(durationInMinutes.toString());
      setExercises(fetchedWorkout.exercises || []);
    } catch (error) {
      console.error("Error fetching workout:", error);
      showAlert("Error", "Failed to load workout details.");
    } finally {
      setLoading(false);
    }
  };

  const updateExerciseField = (exerciseId: number, field: keyof Exercise, value: string | number) => {
    setExercises((prevExercises) =>
      prevExercises.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex))
    );
  };

  const handleUpdateWorkout = async () => {
    if (!workout) return;

    for (const exercise of exercises) {
      if (!exercise.exercise.trim()) {
        showAlert("Error", "Every exercise must have a valid name.");
        return;
      }
      if (exercise.sets < 1 || exercise.reps < 1 || exercise.weight < 1) {
        showAlert("Error", "Sets, reps, and weight for each exercise must be at least 1.");
        return;
      }
    }
    
    const updatedWorkout = {
      ...workout,
      exercises,
    };

    try {
      await apiClient.put<ApiResponse<Workout>>(`/workout/${workout.id}`, updatedWorkout);
      showAlert("Success", "Workout updated successfully.");
      router.push("/(home)/nav-bar");
    } catch (error) {
      console.error("Update failed:", error);
      showAlert("Error", "Failed to update workout.");
    }
  };

  const handleDeleteWorkout = async () => {
    if (!workout) return;
    const confirmed = await showConfirm("Delete Workout", "Are you sure you want to delete this workout?");
    if (!confirmed) return;
    try {
      await apiClient.delete(`/workout/${workout.id}`);
      showAlert("Success", "Workout deleted successfully.");
      router.push("/(home)/nav-bar");
    } catch (error) {
      console.error("Delete failed:", error);
      showAlert("Error", "Failed to delete workout.");
    }
  };

  if (loading || !workout) {
    return (
      <View style={styles.loaderContainer}>
        <Title style={styles.loaderText}>Loading...</Title>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color="#6200EE"/>
            </TouchableOpacity>
            <Title style={styles.title}>Session {workout.id}</Title>
            <Text style={styles.durationText}>{duration} min</Text>
          </View>
        </Card.Content>
      </Card>

      {exercises.map((exercise, index) => (
        <ExerciseInfoCard
          key={exercise.id}
          exercise={exercise}
          index={index}
          onUpdate={updateExerciseField}
        />
      ))}

      <View style={styles.buttonContainer}>
        <Button mode="contained" onPress={handleUpdateWorkout} style={styles.updateButton}>
          Update Workout
        </Button>
        <Button mode="contained" onPress={handleDeleteWorkout} style={styles.deleteButton}>
          Delete Workout
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    padding: 16,
  },
  card: {
    marginBottom: 15,
    elevation: 4,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  durationText: {
    fontSize: 16,
    color: "#6200EE",
    fontWeight: "500",
  },
  exerciseTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  exerciseStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonContainer: {
    marginTop: 5,
  },
  updateButton: {
    marginBottom: 8,
  },
  deleteButton: {
    backgroundColor: "#ab3d37",
    borderWidth: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loaderText: {
    fontSize: 18,
    color: "#333",
  },
});