<script setup lang="ts">
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { VDomFlowNodeData, VDomSimulationMark } from '@/app/types/vdom.type'

const props = defineProps<NodeProps<VDomFlowNodeData>>()

const { data, selected } = props

const nodeTooltip = computed(() => {
        const hint = data.expression ?? data.textContent ?? data.sourcePreview

        return [
                `AST Kind: ${data.astKind}`,
                `Path: ${data.treePath}`,
                `Depth: ${data.depth}`,
                `Children: ${data.childCount}`,
                `Classification: ${data.classification}`,
                `Patch Flag: ${data.patchFlagText ?? 'None'}`,
                `Hint: ${hint || '-'}`,
        ].join('\n')
})

const simulationBadge = computed(() => {
        const labelByMark: Record<VDomSimulationMark, string> = {
                none: '',
                'compile-target': 'Compile Target',
                'render-target': 'Render Target',
                'diff-added': 'Added',
                'diff-changed': 'Changed',
                'patch-commit': 'Patched',
        }

        const mark = data.simulationMark

        if (!mark || mark === 'none') {
                return null
        }

        return labelByMark[mark]
})

const simulationHighlightClass = computed(() => {
        if (!data.simulationMark || data.simulationMark === 'none') {
                return ''
        }

        if (data.simulationMark === 'diff-added') {
                return 'ring-2 ring-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]'
        }

        if (data.simulationMark === 'diff-changed') {
                return 'ring-2 ring-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]'
        }

        if (data.simulationMark === 'patch-commit') {
                return 'ring-2 ring-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]'
        }

        return 'ring-2 ring-violet-500 shadow-[0_0_0_1px_rgba(139,92,246,0.35)]'
})
</script>

<template>
        <div
                class="flex flex-col gap-2 rounded-xl border border-[var(--color-border-strong)] px-3 py-2.5 text-[0.75rem] shadow-sm transition-all duration-300"
                :class="[
                        data.classification === 'dynamic'
                                ? 'bg-[var(--color-dynamic-node)]'
                                : 'bg-[var(--color-static-node)]',
                        selected
                                ? 'ring-[3px] ring-[var(--color-brand)] shadow-xl z-50 min-w-[280px]'
                                : 'min-w-[200px] ' + simulationHighlightClass,
                ]"
                :title="!selected ? nodeTooltip : undefined"
        >
                <div class="flex items-start justify-between gap-2">
                        <strong class="max-w-[180px] break-words text-[0.85rem] leading-tight text-[var(--color-text-ds)] font-extrabold">
                                {{ data.label }}
                        </strong>
                        <span class="rounded-md border border-[var(--color-border-strong)] bg-white/90 px-1.5 py-0.5 text-[0.65rem] font-bold shadow-sm whitespace-nowrap">
                                {{ data.astKind }}
                        </span>
                </div>

                <div v-if="simulationBadge" class="inline-flex w-fit">
                        <p class="m-0 rounded border border-current bg-white/90 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--color-text-dim)]">
                                {{ simulationBadge }}
                        </p>
                </div>

                <div class="flex justify-between items-center text-[0.7rem] font-semibold text-[var(--color-text-ds)]/80 border-b border-[var(--color-border-strong)]/30 pb-1.5">
                        <span class="flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                Path <span>{{ data.treePath }}</span>
                        </span>
                        <span>Depth {{ data.depth }}</span>
                </div>

                <!-- Expanded Details Container -->
                <div v-if="selected" class="flex flex-col gap-2.5 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div class="grid grid-cols-2 gap-2 text-[0.7rem]">
                                <div class="flex flex-col gap-0.5 p-1.5 bg-white/60 rounded-md border border-[var(--color-border-ds)]/50">
                                        <span class="text-[0.6rem] uppercase font-bold text-[var(--color-text-faint)]">Class</span>
                                        <span class="font-medium text-[var(--color-text-ds)] capitalize">{{ data.classification }}</span>
                                </div>
                                <div class="flex flex-col gap-0.5 p-1.5 bg-white/60 rounded-md border border-[var(--color-border-ds)]/50">
                                        <span class="text-[0.6rem] uppercase font-bold text-[var(--color-text-faint)]">Patch Flag</span>
                                        <span class="font-medium text-[var(--color-brand-surface)]">{{ data.patchFlagText ? 'PF_' + data.patchFlagText : 'None' }}</span>
                                </div>
                        </div>

                        <!-- Props & Attributes -->
                        <div v-if="data.attributeNames && data.attributeNames.length > 0" class="flex flex-col gap-1.5 bg-white/60 p-2 rounded-md border border-[var(--color-border-ds)]/50">
                                <span class="text-[0.65rem] uppercase font-extrabold text-[var(--color-text-faint)] tracking-wider">Atribut / Props</span>
                                <ul class="m-0 flex flex-wrap gap-1.5 pl-0 list-none text-[0.7rem] font-mono">
                                        <li v-for="(val, i) in data.attributeNames" :key="i" class="flex items-start gap-1.5 break-all">
                                                <span class="text-blue-700 bg-blue-100/50 px-1.5 py-0.5 rounded">{{ val }}</span>
                                        </li>
                                </ul>
                        </div>

                        <!-- Directives -->
                        <div v-if="data.directiveNames && data.directiveNames.length > 0" class="flex flex-col gap-1.5 bg-white/60 p-2 rounded-md border border-[var(--color-border-ds)]/50">
                                <span class="text-[0.65rem] uppercase font-extrabold text-[var(--color-text-faint)] tracking-wider">Direktif</span>
                                <ul class="m-0 flex flex-wrap gap-1.5 pl-0 list-none text-[0.7rem] font-mono">
                                        <li v-for="(val, i) in data.directiveNames" :key="i" class="flex items-center gap-1 text-[var(--color-text-ds)]">
                                                <span class="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[0.65rem] font-bold">
                                                        {{ val }}
                                                </span>
                                        </li>
                                </ul>
                        </div>

                        <!-- Evaluated Expressions -->
                        <div v-if="data.expression || data.textContent" class="flex flex-col gap-1.5 bg-white/60 p-2 rounded-md border border-[var(--color-border-ds)]/50">
                                <span class="text-[0.65rem] uppercase font-extrabold text-[var(--color-text-faint)] tracking-wider">Ekspresi / Teks</span>
                                <div class="bg-gray-800 text-green-300 font-mono text-[0.65rem] p-2 rounded break-words whitespace-pre-wrap leading-tight shadow-inner">
                                        {{ data.expression ?? data.textContent }}
                                </div>
                        </div>

                        <!-- Source Review -->
                        <div v-if="data.sourcePreview" class="flex flex-col gap-1.5 bg-white/60 p-2 rounded-md border border-[var(--color-border-ds)]/50">
                                <span class="text-[0.65rem] uppercase font-extrabold text-[var(--color-text-faint)] tracking-wider flex justify-between">
                                        Source <span class="text-[0.6rem] normal-case bg-black/10 px-1.5 py-0.5 rounded ml-2">L{{ data.startLine }}:{{ data.startColumn }} - L{{ data.endLine }}:{{ data.endColumn }}</span>
                                </span>
                                <pre class="m-0 bg-slate-50 text-[var(--color-text-ds)] font-mono text-[0.65rem] p-2 rounded border border-[var(--color-border-strong)]/30 overflow-x-auto">{{ data.sourcePreview }}</pre>
                        </div>
                </div>

                <!-- Collapsed simple text -->
                <div v-else class="flex justify-between gap-1 text-[0.65rem] font-bold uppercase tracking-[0.03em] pt-0.5 text-[var(--color-text-dim)]">
                        <span>{{ data.classification }}</span>
                        <span>{{ data.patchFlagText ? 'PF_' + data.patchFlagText : 'PF_NONE' }}</span>
                </div>
        </div>
</template>
