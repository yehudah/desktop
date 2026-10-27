/**
 * Find the first argument that is an app URL using one of the given
 * protocols (e.g. `x-github-client`).
 *
 * On Linux the desktop entry (`Exec=github-desktop %U`) passes the URL as a
 * positional argument, both on cold start (`process.argv`) and when forwarded
 * to the running instance through the `second-instance` event. Chromium may
 * add its own switches around it, so we look through all arguments rather
 * than relying on a fixed position. The URL is returned as-is (still
 * percent-encoded); `parseAppURL` takes care of decoding.
 */
export function findAppURLInArgs(
  args: ReadonlyArray<string>,
  protocols: Iterable<string>
): string | null {
  const prefixes = Array.from(protocols, p => `${p.toLowerCase()}://`)

  for (const rawArg of args) {
    const arg = stripQuotes(rawArg)
    const lowerArg = arg.toLowerCase()

    if (!prefixes.some(p => lowerArg.startsWith(p))) {
      continue
    }

    try {
      new URL(arg)
      return arg
    } catch {
      continue
    }
  }

  return null
}

/** Remove one pair of matching surrounding quotes, if present */
function stripQuotes(arg: string) {
  const first = arg.at(0)
  if (
    arg.length >= 2 &&
    (first === '"' || first === "'") &&
    arg.at(-1) === first
  ) {
    return arg.slice(1, -1)
  }
  return arg
}
