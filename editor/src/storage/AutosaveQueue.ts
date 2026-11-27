/** Serializes full-snapshot saves and retains only the newest snapshot waiting behind the active save. */
export class AutosaveQueue<T> {
  private pending?: T
  private processing?: Promise<void>
  private lastError?: Error

  constructor(private readonly save: (value: T) => Promise<void>) {}

  enqueue(value: T): void {
    this.pending = value
    this.lastError = undefined
    this.processing ??= this.process()
  }

  /**
   * Waits until no save is active or pending, including one enqueued while this method is
   * already waiting. Rejects if the final attempted save failed. It remains pending if the
   * underlying save never settles or callers continue enqueueing snapshots indefinitely.
   */
  async flush(): Promise<void> {
    while (this.processing) await this.processing
    if (this.lastError) throw this.lastError
  }

  /**
   * Drops snapshots that have not started, waits for an active write to settle, and forgets its result. Used only
   * after a person confirms that the working copy itself should be deleted.
   */
  async discardPendingAndWait(): Promise<void> {
    this.pending = undefined
    while (this.processing) await this.processing
    this.lastError = undefined
  }

  private async process(): Promise<void> {
    try {
      while (this.pending !== undefined) {
        const value = this.pending
        this.pending = undefined
        try {
          await this.save(value)
          this.lastError = undefined
        } catch (error) {
          this.lastError = error instanceof Error ? error : new Error(String(error))
        }
      }
    } finally {
      this.processing = undefined
    }
  }
}
