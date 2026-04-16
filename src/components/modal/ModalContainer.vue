<script setup lang="ts">
const { open = false, title = '' } = defineProps<{
	open?: boolean
	title?: string
}>()

const emit = defineEmits<{
	close: []
}>()

function closeModal(): void {
	emit('close')
}
</script>

<template>
	<div
		v-if="open"
		class="fixed inset-0 grid place-items-center bg-black/45 p-4"
		@click.self="closeModal"
	>
		<div
			class="w-full max-w-[640px] overflow-hidden rounded-xl border border-[color:var(--line-soft)] bg-white"
		>
			<header
				class="flex items-center justify-between gap-2 border-b border-[color:var(--line-soft)] px-4 py-3"
			>
				<h3>{{ title }}</h3>
				<button
					type="button"
					class="cursor-pointer rounded-md bg-[color:var(--surface-2)] px-3 py-2 text-sm font-semibold text-[color:var(--text-main)] transition hover:brightness-105"
					@click="closeModal"
				>
					Close
				</button>
			</header>
			<section class="p-4">
				<slot />
			</section>
		</div>
	</div>
</template>
