# vitestx

Vitest extensions: fuzz testing + dot reporter. Async generators, auto-shrinking, chaos streams, and a streaming dot reporter with inkx.

```typescript
import { test, gen, take } from "vitestx"

test.fuzz("cursor stays in bounds", async () => {
  for await (const key of take(gen(["j", "k", "h", "l"]), 100)) {
    await handle.press(key)
    expect(getCursor()).toBeGreaterThanOrEqual(0)
  }
  // On failure: auto-shrinks to minimal repro, saves to __fuzz_cases__/
})
```

## Core Idea

Three composable primitives:

| Primitive      | What it does                                               |
| -------------- | ---------------------------------------------------------- |
| `gen(picker)`  | Infinite async generator of random values                  |
| `take(gen, n)` | Limits iteration, auto-tracks values via AsyncLocalStorage |
| `test.fuzz()`  | Wraps vitest `test()` with shrinking and regression        |

When a fuzz test fails:

1. **Shrink** — delta-debugging finds the minimal failing sequence
2. **Save** — failing case stored in `__fuzz_cases__/` as regression
3. **Replay** — saved cases re-run automatically on `vitest run`

## Generators

```typescript
// Uniform random from array
gen(["j", "k", "h", "l"])

// Weighted random — 40% j, 40% k, 10% Enter, 10% Escape
gen([
  [40, "j"],
  [40, "k"],
  [10, "Enter"],
  [10, "Escape"],
])

// Custom picker — stateful, async, whatever you need
gen((ctx) => {
  const state = getState()
  if (state.cursor === 0) return ctx.random.pick(["j", "l"])
  return ctx.random.pick(["j", "k", "h", "l"])
})

// Async picker — call an LLM, read a file, whatever
gen(async (ctx) => {
  const suggestion = await askModel(describeState())
  return suggestion
})
```

## Chaos Stream Transformers

Composable async iterable transformers that simulate unreliable delivery. Sit between `gen()` and `take()` — or between any async iterables.

```typescript
import { drop, reorder, duplicate, chaos } from 'vitestx/chaos'

// Manual composition
const events = gen(eventPicker)
const unreliable = reorder(drop(events, 0.2, rng), 5, rng)
for await (const event of take(unreliable, 200)) { ... }

// Or use the chaos() combinator
const chaotic = chaos(source, [
  { type: 'drop', params: { rate: 0.2 } },
  { type: 'reorder', params: { windowSize: 5 } },
  { type: 'duplicate', params: { rate: 0.1 } },
], rng)
```

### Built-in Transformers

| Transformer                        | What it simulates                          |
| ---------------------------------- | ------------------------------------------ |
| `drop(source, rate, rng)`          | Message loss, queue overflow               |
| `reorder(source, windowSize, rng)` | Out-of-order delivery                      |
| `duplicate(source, rate, rng)`     | At-least-once / duplicate delivery         |
| `burst(source, burstSize)`         | Bursty delivery, batched packets           |
| `initGap(source, count)`           | Missed events during init, late subscriber |
| `delay(source, minMs, maxMs, rng)` | Slow I/O, network latency                  |

### Custom Registries

Extend the built-in registry with domain-specific transformers:

```typescript
import { chaos, builtinChaosRegistry, type ChaosRegistry } from "vitestx/chaos"

const fsRegistry: ChaosRegistry<FsEvent> = {
  ...builtinChaosRegistry,
  atomic_save: (s, p, rng) => atomicSave(s, p.rate ?? 0.5, rng),
  coalesce: (s, p, rng) => coalesce(s, p.threshold ?? 10, rng),
}

const chaotic = chaos(source, configs, rng, fsRegistry)
```

## Seeded RNG

Deterministic random for reproducible tests:

```typescript
import { createSeededRandom } from "vitestx"

const rng = createSeededRandom(42)
rng.int(0, 100) // deterministic integer
rng.float() // deterministic [0, 1)
rng.pick(["a", "b"]) // deterministic pick
rng.bool(0.3) // 30% chance of true
rng.shuffle([1, 2, 3]) // deterministic shuffle
rng.fork() // independent child stream
```

## Dotz Reporter

A streaming vitest reporter that renders test results as colored dots using inkx (React terminal UI).

```bash
# Use as vitest reporter
vitest run --reporter=vitestx/dotz
```

Features:

- Incremental rendering via `useSyncExternalStore` + inkx `flush()`
- Duration-based dot symbols: `·` fast, `•` medium, `●` slow
- Status dots: `x` fail, `-` skip, `*` pending, `!` noisy
- Per-package categorization with file breakout for large packages
- Slow test summary with configurable threshold
- Console capture via inkx `<Console />`
- Static fallback for non-TTY environments (CI)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    reporters: ["vitestx/dotz"],
  },
})
```

## Imports

```typescript
import { test, gen, take, createSeededRandom } from "vitestx"
import { chaos, drop, reorder, builtinChaosRegistry } from "vitestx/chaos"
```

`vitestx` re-exports everything from `vitestx/fuzz`. Use the subpath if you prefer explicit imports.

## Reproducibility

```bash
# Run with specific seed
FUZZ_SEED=12345 bun test

# Failures auto-save to __fuzz_cases__/ — replayed on next run
bun test
```

## Install

```bash
bun add vitestx
```

## License

MIT
