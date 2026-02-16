/**
 * In-App Review Prompt
 * 
 * Non-intrusive review prompt that only triggers when:
 * 1. User has been using the app for at least 14 days
 * 2. User has created at least 5 shifts (they're actually using it)
 * 3. We haven't asked in the last 90 days
 * 4. We haven't asked more than 2 times total
 * 
 * Uses the native Google Play in-app review dialog (not a custom popup),
 * which is the least annoying option — Google controls the UI and may
 * choose not to show it if the user has recently reviewed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = '@kinshift/review_prompt';

interface ReviewState {
  firstLaunch: number;       // timestamp of first app launch
  timesAsked: number;        // how many times we've triggered the prompt
  lastAskedAt: number;       // timestamp of last prompt
  shiftsCreated: number;     // running count of shifts created
}

const DEFAULT_STATE: ReviewState = {
  firstLaunch: Date.now(),
  timesAsked: 0,
  lastAskedAt: 0,
  shiftsCreated: 0,
};

// Configuration — tune these to be respectful
const MIN_DAYS_BEFORE_FIRST_PROMPT = 14;   // Wait 2 weeks
const MIN_DAYS_BETWEEN_PROMPTS = 90;        // Don't ask again for 3 months
const MAX_TOTAL_PROMPTS = 2;                // Never ask more than twice
const MIN_SHIFTS_CREATED = 5;               // They must have actually used it

async function getState(): Promise<ReviewState> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      return { ...DEFAULT_STATE, ...JSON.parse(json) };
    }
  } catch {
    // Silently fall back to defaults
  }
  return { ...DEFAULT_STATE };
}

async function saveState(state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-critical — ignore
  }
}

/**
 * Call this once on app launch to record first-ever launch date
 */
export async function initReviewTracking(): Promise<void> {
  const state = await getState();
  if (state.firstLaunch === DEFAULT_STATE.firstLaunch) {
    // First time — check if key already existed
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existing) {
      await saveState({ ...DEFAULT_STATE, firstLaunch: Date.now() });
    }
  }
}

/**
 * Call this every time a shift is successfully created.
 * Lightweight — just increments a counter.
 */
export async function trackShiftCreated(): Promise<void> {
  const state = await getState();
  state.shiftsCreated += 1;
  await saveState(state);
}

/**
 * Check if conditions are met and trigger the native review dialog.
 * Call this at a natural moment (e.g., after saving a shift successfully).
 * 
 * Returns true if the prompt was triggered, false if conditions weren't met.
 * Note: Even when triggered, Google/Apple may choose not to show the dialog.
 */
export async function maybeRequestReview(): Promise<boolean> {
  try {
    const state = await getState();
    const now = Date.now();
    const daysSinceFirstLaunch = (now - state.firstLaunch) / (1000 * 60 * 60 * 24);
    const daysSinceLastAsk = state.lastAskedAt > 0
      ? (now - state.lastAskedAt) / (1000 * 60 * 60 * 24)
      : Infinity;

    // Check all conditions
    if (daysSinceFirstLaunch < MIN_DAYS_BEFORE_FIRST_PROMPT) return false;
    if (state.shiftsCreated < MIN_SHIFTS_CREATED) return false;
    if (state.timesAsked >= MAX_TOTAL_PROMPTS) return false;
    if (daysSinceLastAsk < MIN_DAYS_BETWEEN_PROMPTS) return false;

    // All conditions met — request native review
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const StoreReview = await import('expo-store-review');
      
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return false;

      // This opens the native in-app review sheet — Google/Apple controls the UX
      // It's NOT a custom popup, so it feels native and non-intrusive
      await StoreReview.requestReview();

      // Record that we asked
      state.timesAsked += 1;
      state.lastAskedAt = now;
      await saveState(state);

      return true;
    }

    return false;
  } catch {
    // Never crash the app over a review prompt
    return false;
  }
}
