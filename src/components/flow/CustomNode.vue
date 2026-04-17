<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import type { VDomFlowNodeData } from '@/app/types/vdom.type'

const { data } = defineProps<NodeProps<VDomFlowNodeData>>()
</script>

<template>
	<div
		:class="[
			data.classification === 'dynamic'
				? 'border-blue-800 bg-blue-50'
				: 'border-rose-800 bg-rose-50'
		]"
		class="flex flex-col gap-4 rounded-lg border px-3 py-2.5 text-[0.75rem] min-w-[200px] shadow-sm transition-all duration-300"
	>
		<div class="flex items-start justify-between gap-2">
			<span class="font-[700] text-[14px] max-w-[180px] font-mono whitespace-nowrap truncate">{{ data.label }}</span>
			<span class="font-[500] text-[12px] tracking-wide text-zinc-800 whitespace-nowrap px-1.5 py-0.5 border border-zinc-800 rounded-sm bg-white">{{ data.astKind }}</span>
		</div>
		<div class="flex items-start justify-between gap-2 text-black">
			<span class="text-[11px] items-center flex gap-2"><i class="pi pi-sitemap mt-[1px]" />Path {{ data.treePath }}</span>
			<span class="text-[11px]">Depth {{ data.depth }}</span>
		</div>
	</div>
</template>
