# vitestx

**Ergonomic fuzz testing for Vitest.**

```typescript
import { test, gen, take } from 'vitestx'

test.fuzz('cursor stays in bounds', async () => {
  const handle = await run(<Board />)

  for await (const key of take(gen(['j', 'k', 'h', 'l']), 100)) {
    await handle.press(key)
    expect(handle.locator('[data-cursor]').count()).toBe(1)
  }
  // On failure: auto-shrinks to minimal repro, saves to __fuzz_cases__/
})
```

## How It Works

`gen()` produces random actions. `take()` limits and tracks them. `test.fuzz()` wraps vitest's `test()` with shrinking and regression support.

When a fuzz test fails:
1. **Shrink** — delta-debugging finds the minimal failing sequence
2. **Save** — failing case stored in `__fuzz_cases__/` for regression
3. **Replay** — saved cases re-run on next `vitest run`

## Generators

```typescript
// Uniform random
gen(['j', 'k', 'h', 'l'])

// Weighted random
gen([[40, 'j'], [40, 'k'], [10, 'Enter'], [10, 'Escape']])

// Custom picker (stateful, async, preconditions)
gen((ctx) => {
  const state = getState()
  if (state.cursor === 0) return ctx.random.pick(['j', 'l'])
  return ctx.random.pick(['j', 'k', 'h', 'l'])
})
```

## Fuzz Terms (inkx integration)

For testing inkx apps via the Provider interface:

```typescript
import { createFuzzTerm, createReplayTerm } from 'vitestx'

// Random key provider
const term = createFuzzTerm({ keys: ['j', 'k', 'Enter'], count: 100, seed: 42 })

// Smart/async pick provider — pick(state, history, random)
const term = createFuzzTerm({
  pick: async (state, history, random) => chooseKey(state, history, random),
  count: 100,
})

// Replay for shrinking
const term = createReplayTerm(['j', 'j', 'k', 'Enter'])
```

## Future Directions

The gen/take/test.fuzz primitives are composable — future capabilities are helpers, not new architecture:

- **Preconditioned generators** — filter actions by current state via custom picker
- **Automatic invariant checking** — wrap async iterables to assert after every yield
- **AI-driven exploration** — LLM picks actions via async custom picker
- **Chaos testing on vitestx** — rebase km's sync chaos tests (watcher-chaos scenarios) on gen/take, replacing the custom chaos runner with vitestx's shrinking and regression infrastructure

## Install

```bash
bun add vitestx
```

## License

MIT
