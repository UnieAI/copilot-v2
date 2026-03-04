/**
 * Binary search for sorted arrays keyed by string ID.
 * Returns { found, index } where index is the position for insert if not found.
 */
export function binarySearch<T>(
  arr: T[],
  targetId: string,
  keyFn: (item: T) => string
): { found: boolean; index: number } {
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const midId = keyFn(arr[mid])
    if (midId === targetId) return { found: true, index: mid }
    if (midId < targetId) lo = mid + 1
    else hi = mid - 1
  }
  return { found: false, index: lo }
}

/** Insert or update an item in a sorted array by ID. Returns a new array. */
export function sortedUpsert<T>(
  arr: T[],
  item: T,
  keyFn: (item: T) => string
): T[] {
  const id = keyFn(item)
  const { found, index } = binarySearch(arr, id, keyFn)
  const next = [...arr]
  if (found) {
    next[index] = item
  } else {
    next.splice(index, 0, item)
  }
  return next
}

/** Remove an item from a sorted array by ID. Returns a new array. */
export function sortedRemove<T>(
  arr: T[],
  targetId: string,
  keyFn: (item: T) => string
): T[] {
  const { found, index } = binarySearch(arr, targetId, keyFn)
  if (!found) return arr
  const next = [...arr]
  next.splice(index, 1)
  return next
}
