<script setup lang="ts">
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { ProcessStageFlowNodeData } from '@/composable/useVdomProcessFlow'

const { data, selected } = defineProps<NodeProps<ProcessStageFlowNodeData>>()

const stageStateClass = computed(() => {
	if (selected || data.isActive) {
		return 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 shadow-[0_8px_18px_rgba(16,185,129,0.24)]'
	}

	return 'border-slate-300 bg-white hover:border-slate-400'
})
</script>

<template>
	<div
		class="flex w-[230px] flex-col gap-1.5 rounded-xl border px-3 py-2 text-[0.72rem] shadow-sm transition"
		:class="stageStateClass"
	>
		<div class="flex items-center justify-between gap-2">
			<strong class="text-[0.78rem] leading-tight text-slate-800">{{ data.title }}</strong>
			<span
				class="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[0.63rem] font-bold text-slate-600"
			>
				S{{ data.index }}
			</span>
		</div>

		<p class="m-0 text-[0.67rem] font-semibold text-slate-600">{{ data.subtitle }}</p>

		<p
			class="m-0 rounded-md border border-slate-200 bg-white/85 px-2 py-1 text-[0.63rem] text-slate-600"
		>
			{{ data.metric }}
		</p>
	</div>
</template>
