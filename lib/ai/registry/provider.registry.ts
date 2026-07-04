import type { AIProvider } from '../providers/provider.interface';

// ---------------------------------------------------------------------------
// ProviderRegistry
// ---------------------------------------------------------------------------

/**
 * Holds a collection of registered AI providers and returns them in
 * priority order for the inference router.
 *
 * The registry is intentionally simple — it is a sorted list, not a
 * service locator. All provider configuration happens at registration
 * time (in the singleton factory below), and the router consumes the
 * sorted result without any further decision-making logic.
 *
 * ## Usage
 *
 * ```ts
 * const registry = new ProviderRegistry()
 *   .register(new OllamaProvider(...))
 *   .register(new CloudProvider(...));
 *
 * const providers = registry.getAll(); // sorted by priority ascending
 * ```
 *
 * ## Extending
 *
 * To add a new provider (e.g. a WebGPU or ONNX provider), register it
 * here with the appropriate priority. Everything else — the router,
 * services, and the public `infer()` function — requires no changes.
 */
export class ProviderRegistry {
  private readonly providers: AIProvider[] = [];

  /**
   * Registers a provider. Returns `this` for fluent chaining.
   *
   * @param provider - Any object that implements the `AIProvider` interface.
   */
  register(provider: AIProvider): this {
    this.providers.push(provider);
    return this;
  }

  /**
   * Returns all registered providers sorted by `priority` ascending.
   * Providers with the same priority are returned in registration order.
   *
   * Returns a new array on every call — the internal list is never mutated
   * by the caller.
   */
  getAll(): AIProvider[] {
    return [...this.providers].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Returns the number of registered providers.
   * Useful for startup assertions and tests.
   */
  get size(): number {
    return this.providers.length;
  }
}
