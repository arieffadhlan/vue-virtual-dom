<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVdomStore } from '@/app/store/vdom.store'
import Input from '@/components/form/Input.vue'

defineOptions({
	name: 'AppSidebar',
})

const emit = defineEmits<{
	(e: 'close'): void
}>()

const vdomStore = useVdomStore()
const newSnippetName = ref('')

const activeSnippetName = computed({
	get: () => vdomStore.activeSnippet?.name ?? '',
	set: (nextName: string) => {
		void vdomStore.renameActiveSnippet(nextName)
	},
})

function createSnippet(): void {
	const fallbackName = 'Snippet ' + (vdomStore.snippets.length + 1)
	const resolvedName =
		newSnippetName.value.trim().length > 0 ? newSnippetName.value : fallbackName

	void vdomStore.createSnippet(resolvedName)
	newSnippetName.value = ''
}
</script>

<template>
	<aside class="flex h-full w-full flex-col overflow-y-auto p-5">
		<div class="flex items-center justify-between mb-6">
			<h2 class="m-0 text-[1rem] font-bold text-[var(--color-text-ds)]">
				Workspace Snippets
			</h2>
			<button
				class="lg:hidden flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border-ds)] transition hover:bg-[var(--color-background-ds)]"
				@click="emit('close')"
			>
				<i class="pi pi-times text-[0.8rem] text-[var(--color-text-dim)]" aria-hidden="true" />
			</button>
		</div>

		<section class="mb-6 flex flex-col gap-3">
			<Input
				v-model="newSnippetName"
				label="Nama template baru"
				placeholder="Contoh: Nested loops"
			/>
			<button
				type="button"
				class="flex h-9 items-center justify-center rounded-lg bg-[var(--color-brand)] px-3 text-[0.8rem] font-semibold text-[var(--color-brand-text)] transition hover:bg-[var(--color-brand-surface)] focus:ring-2 focus:ring-[var(--color-border-strong)] focus:outline-none focus:ring-offset-1"
				@click="createSnippet"
			>
				Buat Snippet Baru
			</button>
		</section>

		<section class="flex flex-col gap-3">
			<h3 class="m-0 text-[0.85rem] font-bold text-[var(--color-text-ds)]">Snippet Aktif</h3>
			<Input
				v-model="activeSnippetName"
				placeholder="Masukkan nama..."
				:disabled="!vdomStore.activeSnippet"
			/>
			<ul class="m-0 flex list-none flex-col gap-2 p-0">
				<li v-for="snippet in vdomStore.snippets" :key="snippet.id">
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition"
						:class="[
							snippet.id === vdomStore.activeSnippetId
								? 'border-[var(--color-text-ds)] bg-[var(--color-background-ds)] shadow-[0_2px_4px_-1px_rgba(0,0,0,0.04)]'
								: 'border-[var(--color-border-ds)] bg-white hover:border-[var(--color-border-strong)] hover:bg-[var(--color-background-raised)]',
						]"
						@click="vdomStore.selectSnippet(snippet.id)"
					>
						<span class="text-[0.85rem] font-semibold text-[var(--color-text-ds)]">{{
							snippet.name
						}}</span>
					</button>
				</li>
			</ul>
			<button
				v-if="vdomStore.activeSnippetId"
				type="button"
				class="mt-2 flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[0.8rem] font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300"
				@click="vdomStore.removeSnippet(vdomStore.activeSnippetId)"
			>
				Hapus Snippet Aktif
			</button>
		</section>
	</aside>
</template>
