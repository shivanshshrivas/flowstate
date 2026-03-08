# Bridge Tests

## Pattern

Bridge tests verify that each bridge implementation **delegates correctly** to its underlying module. They do not test the module itself (that's the module's own test suite).

### Unit tests (this directory)

Mock the external JS module with `vi.mock()`, then verify:
- Constructor calls `module.initialize()` with the correct credentials
- Each bridge method calls the correct module function
- Return values pass through unchanged

```typescript
vi.mock("../../../shippo/src");
const shippoLib = await import("../../../shippo/src");

const bridge = new ShippoBridgeImpl("test_key");
expect(shippoLib.initialize).toHaveBeenCalledWith("test_key");
```

### Integration tests (future)

For tests that hit live APIs, use the `__integration__/` subdirectory with the `.integration.test.ts` suffix. These are excluded from CI by the vitest config and run manually with:

```
npx vitest run --reporter=verbose src/bridges/__integration__/
```

Integration tests should:
- Use test credentials from `.env.test`
- Assert on shape/type of response, not exact values
- Be idempotent (no side effects that persist)
