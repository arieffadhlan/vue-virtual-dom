<script setup lang="ts">
import { computed } from 'vue'
import type { VDomFlowNodeData } from '@/app/types/vdom.type'

const props = defineProps<{
	node: VDomFlowNodeData | null
}>()

const isDynamic = computed(() => {
	return props.node ? props.node.classification === 'dynamic' : false 
})
</script>

<template>
	<div v-if="!node" class="flex items-center justify-center min-h-[140px] h-full px-6 text-center">
		<div class="flex flex-col items-center gap-2">
			<p class="text-sm max-w-[240px]">Pilih node pada grafik untuk melihat detailnya di sini.</p>
		</div>
	</div>
	<div v-else class="relative flex flex-col h-full p-4">
		<div class="w-full flex flex-col gap-2 border-b border-[#D9D9D9] pb-3 mb-4">
			<div class="px-0 flex flex-row gap-2 items-center">
				<h3 class="font-bold font-mono">
					<template v-if="node.tagName">&lt;{{ node.tagName }}&gt;</template>
					<template v-else>{{ node.label }}</template>
				</h3>
			</div>
			<div class="inline-flex gap-2">
				<span
					:class="[
						isDynamic
							? 'border-blue-800 text-blue-800 bg-blue-50'
							: 'border-rose-800 text-rose-800 bg-rose-50'
					]"
					class="px-2 py-1 border rounded-md text-xs font-medium tracking-wide flex items-center gap-1"
				>
					{{ isDynamic ? 'Dynamic' : 'Static' }}
				</span>
				<span class="px-2 py-1 border border-zinc-800 rounded-md text-xs font-medium tracking-wide text-zinc-800 bg-zinc-300/10">{{ node.astKind }}</span>
				<span class="px-2 py-1 border border-zinc-800 rounded-md text-xs font-medium tracking-wide text-zinc-800 bg-zinc-300/10">Depth: {{ node.depth }}</span>
			</div>
		</div>
		<div class="flex-1 space-y-4 overflow-y-auto pr-1">
			<div v-if="
				(node.attributeNames && node.attributeNames.length > 0) || 
				(node.directiveNames && node.directiveNames.length > 0)" class="flex flex-col gap-2">
				<div class="flex flex-row items-center gap-2">
					<i class="text-xs text-black font-bold pi pi-list"></i>
					<p class="text-xs font-[700] font-mono">ATTR</p>
				</div>
				<ol class="p-2 list-disc space-y-1.5 rounded-md font-mono text-xs border border-green-800 bg-green-50/50">
					<li v-for="attr in node.attributeNames" :key="attr" class="font-bold text-green-800">- {{ attr }}</li>
					<li v-for="dirc in node.directiveNames" :key="dirc" class="font-bold text-green-800">- {{ dirc }}</li>
				</ol>
			</div>
			<div v-if="node.textContent" class="flex flex-col gap-2">
				<div class="flex flex-row items-center gap-2">
					<i class="text-xs text-black font-bold pi pi-align-justify"></i>
					<p class="text-xs font-[700] font-mono">TEXT CONTENT</p>
				</div>
				<div class="p-3 border border-[#D9D9D9] rounded-md font-mono text-xs whitespace-pre bg-zinc-100 overflow-x-auto">
					{{ node.textContent }}
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex flex-row items-center gap-2">
					<i class="text-xs text-black font-bold mt-[1px] pi pi-code"></i>
					<p class="text-xs font-[700] font-mono">CODE SNIPPET</p>
				</div>
				<div class="p-3 border border-[#D9D9D9] rounded-md font-mono text-xs whitespace-pre bg-zinc-100 overflow-x-auto">
					{{ node.source || node.sourcePreview || '(source code tidak tersedia)' }}
				</div>
			</div>
		</div>
	</div>
</template>
