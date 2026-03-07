import { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  type ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../../constants/colors";

const { width } = Dimensions.get("window");

const ONBOARDING_KEY = "deucediary_onboarding_complete";

interface Slide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  detail: string;
}

const slides: Slide[] = [
  {
    id: "welcome",
    emoji: "\uD83D\uDC51",
    title: "Welcome to Deuce Diary",
    subtitle: "The throne awaits.",
    detail:
      "Track your sessions, compete with friends, and build the longest streak on the porcelain throne.",
  },
  {
    id: "log",
    emoji: "\uD83D\uDEBD",
    title: "Log Every Session",
    subtitle: "One tap. Done.",
    detail:
      "Add thoughts, tag your location, and share with your squad. Every deuce counts toward your streak.",
  },
  {
    id: "squad",
    emoji: "\uD83D\uDC65",
    title: "Build Your Squad",
    subtitle: "Never deuce alone.",
    detail:
      "Create or join a squad, invite your crew, and see who\u2019s keeping up. Real-time updates and reactions.",
  },
  {
    id: "streak",
    emoji: "\uD83D\uDD25",
    title: "Keep the Streak Alive",
    subtitle: "Daily accountability. Pure glory.",
    detail:
      "Log every day to build your streak. Earn Bronze, Silver, Gold, and Diamond badges. Don\u2019t break the chain.",
  },
];

/** Mark onboarding as complete in AsyncStorage */
export async function completeOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

/** Check if onboarding has been completed */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === "true";
}

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isNavigating = useRef(false);

  // Fade animation for slide content
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(0)).current;

  // Animate on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate on slide change
  useEffect(() => {
    fadeAnim.setValue(0);
    slideUpAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<Slide>[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const isLastSlide = currentIndex === slides.length - 1;

  async function handleGetStarted() {
    if (isNavigating.current) return;
    isNavigating.current = true;
    await completeOnboarding();
    router.replace("/auth/sign-in" as any);
  }

  function handleNext() {
    if (isLastSlide) {
      handleGetStarted();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  }

  function handleSkip() {
    handleGetStarted();
  }

  function renderSlide({ item }: { item: Slide }) {
    return (
      <View style={styles.slide} accessibilityLabel={`${item.title}. ${item.subtitle}`}>
        <Text style={styles.emoji} accessibilityElementsHidden>
          {item.emoji}
        </Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <Text style={styles.detail}>{item.detail}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Pagination dots */}
      <View style={styles.pagination} accessibilityLabel={`Page ${currentIndex + 1} of ${slides.length}`}>
        {slides.map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.dotActive,
              currentIndex === index && {
                opacity: fadeAnim,
              },
            ]}
          />
        ))}
      </View>

      {/* Progress indicator */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / slides.length) * 100}%` },
          ]}
        />
      </View>

      {/* Buttons */}
      <View style={styles.footer}>
        {!isLastSlide ? (
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.6}
            accessibilityLabel="Skip onboarding"
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        <TouchableOpacity
          style={[styles.nextButton, isLastSlide && styles.getStartedButton]}
          onPress={handleNext}
          activeOpacity={0.8}
          accessibilityLabel={isLastSlide ? "Get started and log your first deuce" : "Next slide"}
          accessibilityRole="button"
        >
          <Text style={styles.nextButtonText}>
            {isLastSlide ? "Log Your First Deuce \uD83D\uDEBD" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.espresso,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.gold,
    textAlign: "center",
    marginBottom: 16,
  },
  detail: {
    fontSize: 15,
    color: Colors.secondaryText,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warmSand,
  },
  dotActive: {
    backgroundColor: Colors.gold,
    width: 24,
    borderRadius: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.lightGray,
    marginHorizontal: 24,
    borderRadius: 2,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.green,
    borderRadius: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  skipText: {
    fontSize: 16,
    color: Colors.secondaryText,
    fontWeight: "500",
  },
  nextButton: {
    backgroundColor: Colors.green,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 999,
  },
  getStartedButton: {
    paddingHorizontal: 28,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
});
