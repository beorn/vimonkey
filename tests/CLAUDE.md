# vitestx Tests

**Test Infrastructure — Vitest Extensions**: Fuzz testing, chaos streams, seeded RNG, environment config, and dotz reporter.

## What to Test Here

- **Fuzz API**: `gen()` with array/weighted/custom pickers, `take()` limiting, deterministic seeding, `fuzzContext`/`createReplayContext`, `shrinkSequence` delta-debugging
- **Random**: `createSeededRandom` determinism, `int()`/`float()`/`pick()`/`shuffle()` range correctness, `parseSeed`
- **Chaos transformers**: `drop`, `reorder`, `duplicate`, `burst`, `initGap`, `delay`, composed `chaos()` pipeline, `builtinChaosRegistry`
- **Environment**: `getTestSys()` parsing (`fake`/`real:mem`/`real:disk`), `isRealSys()`, `isDiskSys()`, invalid value fallback
- **Dotz reporter**: store-driven React rendering via `createTestStore`, test lifecycle (add/update), failure display, slow test threshold, width adaptation
- **Dotz streaming**: incremental rendering via `flush()`, visible text changes after store updates

## What NOT to Test Here

- Vitest internals or reporter protocol — vitestx bridges to them
- hightea rendering details — dotz tests use `createRenderer` as a black box

## Patterns

Fuzz and chaos tests use `createSeededRandom` for deterministic reproduction:

```typescript
import { gen, take, createSeededRandom } from "../src/fuzz/index.js"

test("gen is deterministic with same seed", async () => {
  const v1: string[] = [],
    v2: string[] = []
  for await (const v of take(gen(["a", "b"], 42), 10)) v1.push(v)
  for await (const v of take(gen(["a", "b"], 42), 10)) v2.push(v)
  expect(v1).toEqual(v2)
})
```

Dotz tests use `createTestStore` + `createRenderer` from hightea/testing:

```typescript
import { createTestStore } from "../src/dotz/store.js"
import { Report } from "../src/dotz/index.tsx"

const store = createTestStore(100)
store.addTest("t1", "pkg", "file.test.ts")
store.updateTest("t1", "passed", 10)
const app = render(<Report store={store} options={options} width={80} />)
expect(app.text).toContain("passed")
```

## Ad-Hoc Testing

```bash
bun vitest run vendor/vitestx/tests/              # All vitestx tests
bun vitest run vendor/vitestx/tests/fuzz.fuzz.ts  # Fuzz API tests
bun vitest run vendor/vitestx/tests/chaos.test.ts # Chaos transformers
bun vitest run vendor/vitestx/tests/random.test.ts # Seeded RNG
bun vitest run vendor/vitestx/tests/dotz.test.tsx  # Dotz reporter
```

## Efficiency

Pure logic tests are fast (~50ms). Dotz rendering tests (~200ms) due to hightea renderer. The `dotz-streaming` test uses real `hightea` render with suppressed stdout (~300ms).

## See Also

- [Test layering philosophy](../../.claude/skills/tests/test-layers.md)
