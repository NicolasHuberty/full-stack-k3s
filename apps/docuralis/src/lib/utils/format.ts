/**
 * Format bytes to human-readable string with appropriate unit
 */
export function formatBytes(bytes: number | bigint | string, decimals: number = 1): string {
  const size = Math.abs(Number(bytes))

  if (size === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

  const i = Math.floor(Math.log(size) / Math.log(k))
  const value = size / Math.pow(k, i)

  return `${value.toFixed(dm)} ${sizes[i]}`
}
