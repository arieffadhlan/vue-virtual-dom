export const VDOM_DEBOUNCE_MS = 220

export const WORKSPACE_DB_NAME = 'vue-v-dom-explorer'
export const WORKSPACE_DB_VERSION = 1

export const DEFAULT_SNIPPET_NAME = 'Starter Template'

export const DEFAULT_TEMPLATE = `<section class="workspace-card">
	<h1>{{ title }}</h1>
	<p :class="{ active: isActive }">{{ description }}</p>
	<button @click="count++">{{ count }}</button>
</section>`

export const PATCH_FLAG_LABELS: Record<number, string> = {
	1: 'TEXT',
	2: 'CLASS',
	4: 'STYLE',
	8: 'PROPS',
	16: 'FULL_PROPS',
	32: 'HYDRATE_EVENTS',
	64: 'STABLE_FRAGMENT',
	128: 'KEYED_FRAGMENT',
	256: 'UNKEYED_FRAGMENT',
	512: 'NEED_PATCH',
	1024: 'DYNAMIC_SLOTS',
	2048: 'DEV_ROOT_FRAGMENT',
	['-1']: 'HOISTED',
	['-2']: 'BAIL',
}
