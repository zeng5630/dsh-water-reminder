/**
 * Host half of the water-reminder plugin.
 *
 * The feature lives entirely in the browser half (`./client`), but the package
 * still needs a Loader-visible host entry: `@deepseek-ai/dsh-client-modules`
 * composes its browser graph from the live Loader rows, so an ordinary no-op
 * plugin body is what makes this package addressable from the profile patch.
 */
export function apply() {}
