import { describe, expect, it, vi } from 'vitest'
import { AutosaveQueue } from './AutosaveQueue'

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

describe('AutosaveQueue', () => {
  it('serializes saves and coalesces waiting snapshots to the newest one', async () => {
    const first = deferred<void>()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const queue = new AutosaveQueue<string>(save)

    queue.enqueue('one')
    queue.enqueue('two')
    queue.enqueue('three')
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('one')

    first.resolve()
    await queue.flush()

    expect(save.mock.calls).toEqual([['one'], ['three']])
  })

  it('rejects flush when the final save failed', async () => {
    const failure = new Error('storage failed')
    const queue = new AutosaveQueue<string>(vi.fn().mockRejectedValue(failure))
    queue.enqueue('one')
    await expect(queue.flush()).rejects.toBe(failure)
  })

  it('recovers when a newer save succeeds after an earlier failure', async () => {
    const first = deferred<void>()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const queue = new AutosaveQueue<string>(save)
    queue.enqueue('one')
    queue.enqueue('two')
    first.reject(new Error('first failed'))

    await expect(queue.flush()).resolves.toBeUndefined()
    expect(save.mock.calls).toEqual([['one'], ['two']])
  })

  it('waits for a save already in progress', async () => {
    const saving = deferred<void>()
    const queue = new AutosaveQueue<string>(vi.fn().mockReturnValue(saving.promise))
    queue.enqueue('one')
    let flushed = false
    const flushing = queue.flush().then(() => {
      flushed = true
    })
    await Promise.resolve()
    expect(flushed).toBe(false)

    saving.resolve()
    await flushing
    expect(flushed).toBe(true)
  })
})
