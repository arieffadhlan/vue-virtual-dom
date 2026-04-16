export type DebouncedFn<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
	cancel: () => void
}

export function debounce<TArgs extends unknown[]>(
	fn: (...args: TArgs) => void,
	waitMs: number,
): DebouncedFn<TArgs> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	const wrapped = ((...args: TArgs) => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}

		timeoutId = setTimeout(() => {
			fn(...args)
		}, waitMs)
	}) as DebouncedFn<TArgs>

	wrapped.cancel = () => {
		if (!timeoutId) {
			return
		}

		clearTimeout(timeoutId)
		timeoutId = null
	}

	return wrapped
}
