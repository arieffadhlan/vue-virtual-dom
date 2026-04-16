<script setup lang="ts">
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { ProcessStageFlowNodeData } from '@/composable/useVdomProcessFlow'

const props = defineProps<NodeProps<ProcessStageFlowNodeData>>()

const stageStateClass = computed(() => {
	if (props.selected || props.data.isActive) {
		return props.data.isMain
			? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 shadow-[0_8px_18px_rgba(16,185,129,0.24)]'
			: 'border-blue-400 bg-blue-50 ring-2 ring-blue-300 shadow-[0_6px_14px_rgba(59,130,246,0.18)]'
	}

	return props.data.isMain
		? 'border-slate-300 bg-white hover:border-slate-400'
		: 'border-slate-200 bg-slate-50 hover:border-slate-300'
})

const labelText = computed(() => {
	return props.data.isMain ? 'Tahap Utama' : 'Sub-Proses'
})
</script>

<template>
	<div
		class="flex w-[320px] flex-col gap-2 rounded-xl border px-3 py-3 text-[0.72rem] shadow-sm transition"
		:class="stageStateClass"
	>
		<div
			class="flex items-start justify-between gap-2 border-b"
			:class="props.data.isActive ? 'border-emerald-200' : 'border-slate-200/80'"
			style="padding-bottom: 8px"
		>
			<div class="flex flex-col gap-0.5 w-full">
				<span
					class="text-[0.65rem] font-bold uppercase tracking-wider"
					:class="props.data.isActive ? 'text-emerald-700/80' : 'text-slate-500'"
				>
					{{ labelText }} &middot; {{ props.data.subtitle }}
				</span>
				<strong
					class="text-[0.8rem] leading-tight text-slate-800"
					:class="{
						'text-[0.85rem] text-emerald-900': props.data.isMain && props.data.isActive,
					}"
				>
					{{ props.data.index }}. {{ props.data.title }}
				</strong>
			</div>
		</div>

		<p
			class="m-0 text-[0.72rem] leading-relaxed text-slate-600 mt-1"
			:class="{ 'text-slate-700': props.data.isActive }"
		>
			{{ props.data.summary }}
		</p>

		<p
			v-if="props.data.isMain"
			class="m-0 self-start mt-1.5 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[0.65rem] font-semibold text-slate-700 shadow-sm"
		>
			<span class="text-emerald-600 mr-1 font-bold">&rarr; Analysis Metric:</span>
			{{ props.data.metric }}
		</p>
	</div>
</template>
