<script setup lang="ts">
import { computed } from 'vue'
import type { VDomFlowNodeData } from '@/app/types/vdom.type'

const props = defineProps<{
	node: VDomFlowNodeData | null
}>()

const isDynamic = computed(() => {
	if (!props.node) return false
	return props.node.classification === 'dynamic'
})
</script>

<template>
	<div
		v-if="!node"
		class="flex h-full min-h-[140px] items-center justify-center text-center text-[0.8rem] text-[var(--color-text-faint)] px-6"
	>
		<div class="flex flex-col items-center gap-2">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				class="text-[var(--color-text-dim)]"
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<p class="m-0">
				Pilih node pada diagram untuk melihat detail lengkap tentang struktur dan sifat
				VNode.
			</p>
		</div>
	</div>
	<div v-else class="relative flex h-full flex-col p-4 text-[0.8rem]">
		<header class="mb-4 flex flex-col gap-2 border-b border-[var(--color-border-ds)] pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<h3 class="m-0 text-[1.1rem] font-bold text-[var(--color-text-ds)] font-mono">
						<template v-if="node.tagName">&lt;{{ node.tagName }}&gt;</template>
						<template v-else>{{ node.label }}</template>
					</h3>
					<span
						class="rounded-md border px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider"
						:class="[
							isDynamic
								? 'border-orange-200 bg-orange-50 text-orange-700'
								: 'border-green-200 bg-green-50 text-green-700',
						]"
					>
						{{ isDynamic ? 'Dynamic' : 'Static' }}
					</span>
				</div>
			</div>

			<div class="inline-flex gap-2">
				<span
					class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.7rem] font-bold text-blue-700"
					>Type: {{ node.astKind }}</span
				>
				<span
					class="rounded bg-black/5 px-2 py-1 text-[0.7rem] font-mono text-[var(--color-text-dim)]"
					>Depth: {{ node.depth }}</span
				>
			</div>
		</header>

		<div class="flex-1 space-y-4 overflow-y-auto pr-1">
			<section v-if="node.attributeNames && node.attributeNames.length > 0">
				<h4
					class="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--color-text-dim)]"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
						<line x1="16" y1="13" x2="8" y2="13" />
						<line x1="16" y1="17" x2="8" y2="17" />
						<polyline points="10 9 9 9 8 9" />
					</svg>
					Attributes
				</h4>
				<ul
					class="m-0 list-none space-y-1.5 rounded-lg border border-[var(--color-border-ds)] bg-white p-2 shadow-sm font-mono text-[0.75rem]"
				>
					<li
						v-for="attr in node.attributeNames"
						:key="attr"
						class="flex gap-2 border-b border-[var(--color-background-ds)] pb-1 last:border-0 last:pb-0"
					>
						<span class="text-[var(--color-brand)] font-semibold shrink-0">{{
							attr
						}}</span>
					</li>
				</ul>
			</section>

			<section v-if="node.directiveNames && node.directiveNames.length > 0">
				<h4
					class="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--color-text-dim)]"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
					</svg>
					Directives
				</h4>
				<ul
					class="m-0 list-none space-y-1.5 rounded-lg border border-orange-100 bg-orange-50/50 p-2 font-mono text-[0.75rem]"
				>
					<li
						v-for="dir in node.directiveNames"
						:key="dir"
						class="flex flex-col gap-0.5 border-b border-orange-100 pb-1.5 last:border-0 last:pb-0 font-bold text-orange-600"
					>
						{{ dir }}
					</li>
				</ul>
			</section>

			<section v-if="node.textContent">
				<h4
					class="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--color-text-dim)]"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="4 7 4 4 20 4 20 7" />
						<line x1="9" y1="20" x2="15" y2="20" />
						<line x1="12" y1="4" x2="12" y2="20" />
					</svg>
					Text Content
				</h4>
				<div
					class="rounded-lg border border-[var(--color-border-ds)] bg-white p-2.5 shadow-sm font-mono text-[0.75rem] text-[var(--color-text-ds)] break-words"
				>
					{{ node.textContent }}
				</div>
			</section>

			<section v-if="node.patchFlag != null && node.patchFlag > 0">
				<h4
					class="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--color-text-dim)]"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
					Patch Flag
				</h4>
				<div
					class="rounded-lg border border-[var(--color-border-ds)] bg-white p-2.5 shadow-sm"
				>
					<div class="flex items-end gap-2 mb-1.5">
						<span
							class="font-mono text-[1.1rem] font-bold leading-none text-[var(--color-brand)]"
							>{{ node.patchFlag }}</span
						>
					</div>
					<p class="m-0 text-[0.75rem] text-[var(--color-text-dim)] leading-relaxed">
						{{
							node.patchFlagText ||
							'Tanda bahwa node ini memiliki dynamic binding yang perlu dicek saat re-render.'
						}}
					</p>
				</div>
			</section>

			<section class="mt-4 pt-3 border-t border-[var(--color-border-ds)]">
				<h4
					class="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--color-text-dim)]"
				>
					Source Code
				</h4>
				<pre
					class="m-0 overflow-x-auto rounded-md bg-[var(--color-background-ds)] p-2 text-[0.7rem] leading-relaxed text-[var(--color-text-ds)] border border-[var(--color-border-ds)] font-mono border-dashed"
				><code>{{ node.sourcePreview }}</code></pre>
			</section>
		</div>
	</div>
</template>
