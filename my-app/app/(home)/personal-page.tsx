import type React from "react"
import { useEffect, useState } from "react"
import { ScrollView, View, Text, StyleSheet, Dimensions, TouchableOpacity } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { LineChart } from "react-native-chart-kit"
import { getCurrentUser } from "@/utils/authHelpers"
import apiClient from "@/utils/apiClient"
import type { ApiResponse } from "@/types/api"
import type { Workout } from "@/types/api"
import { useFocusEffect } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"

const { width } = Dimensions.get("window")

const fetchWorkoutData = async (setWorkoutData: React.Dispatch<React.SetStateAction<Workout[] | null>>) => {
  const user = await getCurrentUser()
  const data = await apiClient.get(`/workout/workouts/${user?.userId}`)
  if (data === null) {
    console.error("Could not fetch workout data")
    return
  }

  const workoutData: Workout[] = data.data.data.workouts
  const monthData: Workout[] = []
  for (const workout of workoutData) {
    const month = Number(workout.startTime.toString().split("T")[0].split("-")[1])
    const thisMonth = new Date().getMonth() + 1
    if (month === thisMonth) {
      monthData.push(workout)
    }
  }

  setWorkoutData(monthData)
}

const fetchNumWorkouts = async (
  data: Workout[] | null,
  setNumWorkouts: React.Dispatch<React.SetStateAction<number>>,
) => {
  if (data === null) {
    return
  }

  setNumWorkouts(data.length)
}

const fetchLongestStreak = async (
  data: Workout[] | null,
  setLongestStreak: React.Dispatch<React.SetStateAction<number>>,
) => {
  if (data === null || data.length === 0) {
    setLongestStreak(0)
    return
  }

  const uniqueDates = new Set(data.map((workout) => workout.startTime.toString().split("T")[0]))

  const sortedDates = Array.from(uniqueDates)
    .map((dateStr) => new Date(`${dateStr}T00:00:00Z`))
    .sort((a, b) => a.getTime() - b.getTime())

  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prevTime = sortedDates[i - 1].getTime()
    const currTime = sortedDates[i].getTime()

    const dayDiff = (currTime - prevTime) / (1000 * 60 * 60 * 24)

    if (dayDiff === 1) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else if (dayDiff > 1) {
      currentStreak = 1 // Reset streak for gaps >1 day
    }
  }

  setLongestStreak(maxStreak)
}

function PersonalPage() {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false)
  const [workoutChosen, setWorkoutChosen] = useState("")
  const [workoutMap, setWorkoutMap] = useState<{ [key: string]: number[] }>({})
  const [graph, setGraph] = useState<number[]>([])
  const [workoutData, setWorkoutData] = useState<Workout[] | null>(null)
  const [numWorkouts, setNumWorkouts] = useState<number>(0)
  const [longestStreak, setLongestStreak] = useState<number>(0)

  useFocusEffect(() => {
    fetchWorkoutData(setWorkoutData)
    fetchNumWorkouts(workoutData, setNumWorkouts)
    fetchLongestStreak(workoutData, setLongestStreak)
  })

  useEffect(() => {
    setGraph(workoutMap[workoutChosen])
    fetchUsersWorkouts()
  }, [workoutChosen])

  // Update the graph when a workout is chosen or the workoutMap changes.
  useEffect(() => {
    if (workoutChosen && workoutMap[workoutChosen]) {
      setGraph(workoutMap[workoutChosen])
    }
  }, [workoutChosen, workoutMap])

  const processData = (exerciseMap: Map<string, number[]>) => {
    const temp: { [key: string]: number[] } = {}

    for (const [exerciseName, weights] of exerciseMap) {
      temp[exerciseName] = weights
    }

    setWorkoutMap(temp)

    if (!workoutChosen && Object.keys(temp).length > 0) {
      setWorkoutChosen(Object.keys(temp)[0])
    }
  }

  const fetchUsersWorkouts = async () => {
    try {
      const user = await getCurrentUser()
      if (user === null) {
        showAlert("Error", "User not authenticated")
        return
      }
      const response = await apiClient.get<ApiResponse<any>>(`workout/exercises/${user.userId}`)
      if (response.data && response.data.data) {
        // Convert the response object into a Map.
        const exerciseMap = new Map<string, number[]>(Object.entries(response.data.data))
        processData(exerciseMap)
      } else {
        showAlert("Error", "Invalid response format")
      }
    } catch (error) {
      console.error("Failed to fetch workouts of user:", error)
      showAlert("Error", "Failed to load workouts of user.")
    }
  }

  const handleOptionSelect = (option: string) => {
    setWorkoutChosen(option)
    setIsDropdownVisible(false)
  }

  // Find min and max values for the graph
  const minValue = graph && graph.length > 0 ? Math.min(...graph) : 0
  const maxValue = graph && graph.length > 0 ? Math.max(...graph) : 0

  return (
    <LinearGradient colors={["#1A1A1A", "#333333"]} style={styles.background}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={styles.title}>Personal Page</Text>

          {/* Summary Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Summary</Text>
            <View style={styles.weekRow}>
              {["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
                <View key={index} style={styles.dayColumn}>
                  <Text style={styles.dayText}>{day}</Text>
                </View>
              ))}
            </View>
            {Array.from({ length: 3 }).map((_, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {Array.from({ length: 7 }).map((_, dayIndex) => (
                  <View key={dayIndex} style={[styles.dayColumn]}>
                    <View style={[styles.square, getBoxColor(weekIndex, dayIndex)]} />
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Graph Section */}
          <View style={styles.graphSection}>
            <View style={styles.graphHeader}>
              <Text style={styles.sectionTitle}>
                {workoutChosen ? `${workoutChosen} Progress` : "Workout Progress"}
              </Text>
              <TouchableOpacity style={styles.dropdownButton} onPress={() => setIsDropdownVisible(!isDropdownVisible)}>
                <Ionicons name="options-outline" size={20} color="#555" />
              </TouchableOpacity>
            </View>

            {isDropdownVisible && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {Object.keys(workoutMap).map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dropdownItem, workoutChosen === option && styles.dropdownItemSelected]}
                      onPress={() => handleOptionSelect(option)}
                    >
                      <Text
                        style={[styles.dropdownItemText, workoutChosen === option && styles.dropdownItemTextSelected]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.graphContainer}>
              {graph && graph.length > 0 ? (
                <>
                  <View style={styles.graphStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Current</Text>
                      <Text style={styles.statValue}>{graph[graph.length - 1]}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Max</Text>
                      <Text style={styles.statValue}>{maxValue}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Progress</Text>
                      <Text
                        style={[
                          styles.statValue,
                          graph.length > 1
                            ? graph[graph.length - 1] > graph[0]
                              ? styles.positiveChange
                              : graph[graph.length - 1] < graph[0]
                                ? styles.negativeChange
                                : null
                            : null,
                        ]}
                      >
                        {graph.length > 1
                          ? `${(((graph[graph.length - 1] - graph[0]) / graph[0]) * 100).toFixed(1)}%`
                          : "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chartWrapper}>
                    <LineChart
                      data={{
                        labels: graph.map((_, i) => `${i + 1}`),
                        datasets: [
                          {
                            data: graph,
                            color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
                            strokeWidth: 2,
                          },
                        ],
                      }}
                      width={width * 0.7}
                      height={200}
                      yAxisSuffix=""
                      chartConfig={{
                        backgroundColor: "#fff",
                        backgroundGradientFrom: "#fff",
                        backgroundGradientTo: "#fff",
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: {
                          borderRadius: 16,
                        },
                        propsForDots: {
                          r: "6",
                          strokeWidth: "2",
                          stroke: "#fff",
                        },
                        propsForBackgroundLines: {
                          strokeDasharray: "",
                          stroke: "#e0e0e0",
                          strokeWidth: 1,
                        },
                        formatYLabel: (value) => value.toString(),
                      }}
                      bezier
                      style={{
                        marginVertical: 8,
                        paddingRight: 30,
                        marginLeft: 30,
                      }}
                      
                      withInnerLines={true}
                      withOuterLines={true}
                      withVerticalLines={false}
                      withHorizontalLines={true}
                      withVerticalLabels={true}
                      withHorizontalLabels={true}
                      fromZero={minValue === 0}

                      renderDotContent={({ x, y, index }) => (
                        <View
                          key={index}
                          style={{
                            position: "absolute",
                            top: y - 24,
                            left: x - 12,
                            backgroundColor: "#333",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 10,
                          }}
                        >
                          <Text style={{ color: "white", fontSize: 10 }}>{graph[index]}</Text>
                        </View>
                      )}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="fitness-outline" size={40} color="#DDD" />
                  <Text style={styles.noDataText}>No data available</Text>
                  <Text style={styles.noDataSubtext}>Select a workout to view progress</Text>
                </View>
              )}
            </View>
          </View>

          {/* Consistency Section */}
          <View style={styles.consistencySection}>
            <Text style={styles.sectionTitle}>📅 Consistency</Text>
            <Text style={styles.consistencyHeader}>This month you..</Text>
            {["Went to the gym " + numWorkouts + " times", "Hit a " + longestStreak + " day streak"]?.map(
              (item, index) => (
                <Text key={index} style={styles.consistencyItem}>
                  • {item}
                </Text>
              ),
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  )
}

// Assign colors for daily summary.
const getBoxColor = (weekIndex: number, dayIndex: number) => {
  const colors = [
    ["red", "red", "yellow", "red", "purple", "red", "white"],
    ["white", "red", "red", "yellow", "red", "red", "white"],
    ["red", "purple", "red", "white", "red", "yellow", "red"],
  ]
  return { backgroundColor: colors[weekIndex][dayIndex] }
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 50,
  },
  container: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    width: "80%",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#FFF",
  },
  section: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 10,
  },
  dayColumn: {
    alignItems: "center",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  square: {
    width: 30,
    height: 30,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#333",
    marginVertical: 2,
  },
  graphSection: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  graphHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  graphContainer: {
    width: "100%",
  },
  graphStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  positiveChange: {
    color: "#4CAF50",
  },
  negativeChange: {
    color: "#F44336",
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  noDataContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  noDataText: {
    fontSize: 16,
    color: "#777",
    fontWeight: "bold",
    marginTop: 10,
  },
  noDataSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 5,
  },
  // Improved Dropdown Styles
  dropdownButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  dropdownMenu: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "#FFF",
    borderRadius: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
    width: 180,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  dropdownScroll: {
    maxHeight: 150,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  dropdownItemSelected: {
    backgroundColor: "#F0F0F0",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownItemTextSelected: {
    color: "#6A1B9A",
    fontWeight: "bold",
  },
  // Consistency Section - Unchanged
  consistencySection: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 50,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  consistencyHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  consistencyItem: {
    fontSize: 14,
    marginBottom: 5,
    color: "#555",
  },
})

function showAlert(title: string, message: string) {
  console.warn(`${title}: ${message}`)
}

export default PersonalPage