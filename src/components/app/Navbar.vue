<script setup lang="ts">
import { computed } from 'vue'
import { useVdomStore } from '@/app/store/vdom.store'

defineOptions({
	name: 'AppNavbar',
})

const emit = defineEmits<{
	(e: 'toggle-sidebar'): void
}>()

const vdomStore = useVdomStore()

const statusText = computed(() => {
	if (vdomStore.isCompiling) {
		return 'Mengkompilasi template...'
	}

	if (vdomStore.parseError) {
		return 'Error saat kompilasi'
	}

	return 'Update terakhir: ' + vdomStore.lastCompiledAtLabel
})
</script>

<template>
	<header
		class="z-30 flex items-center justify-between gap-4 border-b border-[var(--color-border-ds)] bg-[var(--color-background-surface)]/80 px-4 py-3 sm:px-6 backdrop-blur-md"
	>
		<div class="flex items-center gap-3 sm:gap-5">
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border-ds)] bg-white text-[var(--color-text-dim)] shadow-sm transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-ds)] hover:bg-[var(--color-background-raised)]"
				@click="emit('toggle-sidebar')"
				aria-label="Toggle Sidebar"
			>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="3" y1="12" x2="21" y2="12"></line>
					<line x1="3" y1="6" x2="21" y2="6"></line>
					<line x1="3" y1="18" x2="21" y2="18"></line>
				</svg>
			</button>
			<div class="flex flex-col">
				<h1
					class="m-0 font-bold tracking-tight text-[1rem] sm:text-[1.1rem] leading-none text-[var(--color-text-ds)]"
				>
					Vue V-DOM Explorer
				</h1>
				<p
					class="m-0 text-[0.75rem] font-medium tracking-[0.03em] uppercase text-[var(--color-text-faint)] mt-0.5"
				>
					BTJ Dev Tooling
				</p>
			</div>
		</div>
		<div
			class="hidden sm:flex items-center gap-2 rounded-full border border-[var(--color-border-ds)] bg-[var(--color-background-ds)] px-3 py-1.5"
		>
			<span
				class="h-2 w-2 rounded-full"
				:class="vdomStore.parseError ? 'bg-red-500' : 'bg-emerald-500'"
			/>
			<p class="m-0 text-[0.75rem] font-semibold text-[var(--color-text-dim)]">
				{{ statusText }}
			</p>
		</div>
	</header>
</template>
