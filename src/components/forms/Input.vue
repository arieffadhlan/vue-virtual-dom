<script setup lang="ts">
defineOptions({
	name: 'FormInput',
})

const modelValue = defineModel<string>({ default: '' })

const {
	label = '',
	placeholder = '',
	disabled = false,
} = defineProps<{
	label?: string
	placeholder?: string
	disabled?: boolean
}>()
</script>

<template>
	<div class="flex flex-col gap-1.5">
		<label v-if="label" class="text-[0.75rem] font-semibold text-[var(--color-text-dim)]">
			{{ label }}
		</label>
		<input
			v-model="modelValue"
			class="w-full rounded-lg border border-[var(--color-border-ds)] bg-white px-3 py-2 text-[0.85rem] text-[var(--color-text-ds)] outline-none transition placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-text-dim)] hover:border-[var(--color-border-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
			type="text"
			:placeholder="placeholder"
			:disabled="disabled"
		/>
	</div>
</template>
