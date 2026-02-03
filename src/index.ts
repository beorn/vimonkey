/**
 * vitestx - Vitest extension with ergonomic fuzz testing
 */

// Ergonomic API (primary)
export { gen, take, type Picker, type PickerContext } from './ergonomic/gen.js'
export { test, FuzzError, type FuzzTestOptions } from './ergonomic/test-fuzz.js'
export { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from './ergonomic/test-fuzz.js'
export { fuzzContext, getFuzzContext, isInFuzzContext, createFuzzContext, createReplayContext, type FuzzContext } from './ergonomic/context.js'
export { shrinkSequence, formatShrinkResult, type ShrinkOptions, type ShrinkResult } from './ergonomic/shrink.js'
export { saveCase, loadCases, loadCasesForTest, deleteCase, clearCases, getFuzzCasesDir, type SavedCase } from './ergonomic/regression.js'

// Utilities
export { createSeededRandom, parseSeed, type SeededRandom } from './random.js'
export { getTestSys, type TestSys } from './env.js'
