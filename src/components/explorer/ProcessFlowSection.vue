<script setup lang="ts">
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import type {
	ProcessDiffLineStatus,
	ProcessFlowStage,
	ProcessFlowStats,
	ProcessStageFlowNodeData,
} from '@/composable/useVdomProcessFlow'
import ProcessStageNode from '@/components/flow/ProcessStageNode.vue'

interface ProcessFlowSectionProps {
	isExpanded: boolean
	sourceBefore: string
	sourceAfter: string
	processError: string | null
	stats: ProcessFlowStats | null
	isPlaying: boolean
	speedMs: number
	stepIndex: number
	stages: ProcessFlowStage[]
	activeStep: ProcessFlowStage | null
	flowNodes: Node<ProcessStageFlowNodeData>[]
	flowEdges: Edge[]
}

const props = defineProps<ProcessFlowSectionProps>()

const emit = defineEmits<{
	'update:is-expanded': [value: boolean]
	'update:source-before': [value: string]
	'update:source-after': [value: string]
	'set-before-from-after': []
	'swap-sources': []
	'toggle-playback': []
	'previous-step': []
	'next-step': []
	'reset-step': []
	'jump-step': [index: number]
	'update:speed-ms': [value: number]
	'flow-node-click': [stageKey: string]
}>()

const flowNodeTypes = {
	['process-stage']: ProcessStageNode,
}

function processDiffLineClass(status: ProcessDiffLineStatus, side: 'left' | 'right'): string {
	if (status === 'same') {
		return 'bg-white text-[var(--color-text-dim)]'
	}

	if (status === 'changed') {
		return 'bg-amber-50 text-amber-900'
	}

	if (status === 'added') {
		return side === 'right'
			? 'bg-emerald-50 text-emerald-900'
			: 'bg-emerald-50/40 text-emerald-800'
	}

	return side === 'left' ? 'bg-rose-50 text-rose-900' : 'bg-rose-50/40 text-rose-800'
}

function handleNodeClick(payload: { node: { id: string } }): void {
	emit('flow-node-click', payload.node.id)
}

function handleSourceBeforeInput(event: Event): void {
	const target = event.target as HTMLTextAreaElement | null
	emit('update:source-before', target?.value ?? '')
}

function handleSourceAfterInput(event: Event): void {
	const target = event.target as HTMLTextAreaElement | null
	emit('update:source-after', target?.value ?? '')
}

function handleSpeedInput(event: Event): void {
	const target = event.target as HTMLInputElement | null
	const nextValue = Number(target?.value ?? props.speedMs)
	emit('update:speed-ms', Number.isFinite(nextValue) ? nextValue : props.speedMs)
}
</script>

<template>
	<article class="rounded-xl border border-[var(--color-border-ds)] bg-white shadow-sm">
		<header
			class="flex items-center justify-between gap-3 border-b border-[var(--color-border-ds)] px-4 py-3"
		>
			<div>
				<h2 class="m-0 text-[1rem] font-bold text-[var(--color-text-ds)]">
					VDOM Process Flow (Awal -> Akhir)
				</h2>
				<p class="m-0 mt-0.5 text-[0.8rem] text-[var(--color-text-faint)]">
					Mengikuti rendering mechanism Vue: compile -> mount/render effect -> patch.
				</p>
			</div>
			<button
				type="button"
				class="rounded-md border border-[var(--color-border-ds)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--color-text-dim)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
				@click="emit('update:is-expanded', !isExpanded)"
			>
				{{ isExpanded ? 'Sembunyikan' : 'Tampilkan' }}
			</button>
		</header>

		<div v-if="isExpanded" class="space-y-4 p-4">
			<div class="grid gap-4 lg:grid-cols-2">
				<label class="flex flex-col gap-2">
					<span
						class="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-dim)]"
					>
						Code Awal
					</span>
					<textarea
						:value="sourceBefore"
						class="min-h-[176px] rounded-lg border border-[var(--color-border-ds)] bg-[var(--color-background-soft)] px-3 py-2 font-mono text-[0.75rem] leading-relaxed text-[var(--color-text-ds)] outline-none transition focus:border-[var(--color-brand)]"
						spellcheck="false"
						@input="handleSourceBeforeInput"
					/>
				</label>
				<label class="flex flex-col gap-2">
					<span
						class="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-dim)]"
					>
						Code Akhir
					</span>
					<textarea
						:value="sourceAfter"
						class="min-h-[176px] rounded-lg border border-[var(--color-border-ds)] bg-[var(--color-background-soft)] px-3 py-2 font-mono text-[0.75rem] leading-relaxed text-[var(--color-text-ds)] outline-none transition focus:border-[var(--color-brand)]"
						spellcheck="false"
						@input="handleSourceAfterInput"
					/>
				</label>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="rounded-md border border-[var(--color-border-ds)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--color-text-ds)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
					@click="emit('set-before-from-after')"
				>
					Gunakan Code Akhir sebagai Awal
				</button>
				<button
					type="button"
					class="rounded-md border border-[var(--color-border-ds)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--color-text-ds)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
					@click="emit('swap-sources')"
				>
					Tukar Awal / Akhir
				</button>
			</div>

			<p
				v-if="processError"
				class="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.78rem] font-semibold text-red-700"
			>
				{{ processError }}
			</p>

			<div
				v-if="stats"
				class="grid gap-2 rounded-lg border border-[var(--color-border-ds)] bg-[var(--color-background-soft)] p-3 sm:grid-cols-2 lg:grid-cols-4"
			>
				<div class="rounded-md border border-[var(--color-border-ds)] bg-white px-3 py-2">
					<p
						class="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
					>
						Node Delta
					</p>
					<p class="m-0 mt-1 text-[0.9rem] font-semibold text-[var(--color-text-ds)]">
						+{{ stats.addedCount }} / -{{ stats.removedCount }} / ~{{
							stats.changedCount
						}}
					</p>
				</div>
				<div class="rounded-md border border-[var(--color-border-ds)] bg-white px-3 py-2">
					<p
						class="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
					>
						Mutasi Patch
					</p>
					<p class="m-0 mt-1 text-[0.9rem] font-semibold text-[var(--color-text-ds)]">
						{{ stats.mutationCount }} operasi
					</p>
				</div>
				<div class="rounded-md border border-[var(--color-border-ds)] bg-white px-3 py-2">
					<p
						class="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
					>
						Node Count
					</p>
					<p class="m-0 mt-1 text-[0.9rem] font-semibold text-[var(--color-text-ds)]">
						{{ stats.beforeNodeCount }} -> {{ stats.afterNodeCount }}
					</p>
				</div>
				<div class="rounded-md border border-[var(--color-border-ds)] bg-white px-3 py-2">
					<p
						class="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
					>
						Line Count
					</p>
					<p class="m-0 mt-1 text-[0.9rem] font-semibold text-[var(--color-text-ds)]">
						{{ stats.beforeLineCount }} -> {{ stats.afterLineCount }}
					</p>
				</div>
			</div>

			<div
				class="rounded-lg border border-[var(--color-border-ds)] bg-[var(--color-background-soft)] p-3"
			>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="rounded-md border border-[var(--color-border-ds)] px-2.5 py-1.5 text-[0.75rem] font-semibold text-[var(--color-text-ds)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
							@click="emit('previous-step')"
						>
							Prev
						</button>
						<button
							type="button"
							class="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-[0.75rem] font-semibold text-white transition hover:brightness-110"
							@click="emit('toggle-playback')"
						>
							{{ isPlaying ? 'Pause' : 'Play' }}
						</button>
						<button
							type="button"
							class="rounded-md border border-[var(--color-border-ds)] px-2.5 py-1.5 text-[0.75rem] font-semibold text-[var(--color-text-ds)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
							@click="emit('next-step')"
						>
							Next
						</button>
						<button
							type="button"
							class="rounded-md border border-[var(--color-border-ds)] px-2.5 py-1.5 text-[0.75rem] font-semibold text-[var(--color-text-ds)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
							@click="emit('reset-step')"
						>
							Reset
						</button>
					</div>

					<div
						class="flex items-center gap-2 text-[0.75rem] text-[var(--color-text-dim)]"
					>
						<span>Speed</span>
						<input
							type="range"
							min="300"
							max="2400"
							step="100"
							:value="speedMs"
							class="w-28 accent-[var(--color-brand)]"
							@input="handleSpeedInput"
						/>
						<span>{{ speedMs }}ms</span>
					</div>
				</div>

				<div class="mt-3 flex flex-wrap items-center gap-2">
					<button
						v-for="(stage, stageIndex) in stages"
						:key="stage.key"
						type="button"
						class="rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition"
						:class="
							stageIndex === stepIndex
								? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
								: 'border-[var(--color-border-ds)] bg-white text-[var(--color-text-dim)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
						"
						@click="emit('jump-step', stageIndex)"
					>
						{{ stageIndex + 1 }}. {{ stage.title }}
					</button>
				</div>
			</div>

			<div
				class="overflow-hidden rounded-lg border border-[var(--color-border-ds)] bg-white shadow-sm flex flex-col"
			>
				<div
					class="bg-[var(--color-background-soft)] px-4 py-3 border-b border-[var(--color-border-ds)]"
				>
					<h3
						class="m-0 text-[0.85rem] font-bold text-[var(--color-text-ds)] flex items-center gap-2"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="text-[var(--color-brand)]"
						>
							<path
								d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
							></path>
							<polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
							<line x1="12" y1="22.08" x2="12" y2="12"></line>
						</svg>
						Graph Highlight
					</h3>
					<p class="m-0 mt-1 text-[0.75rem] text-[var(--color-text-dim)]">
						Node aktif menyorot sub-proses runtime dan hint compiler (cache static,
						patch flags, tree flattening) yang mempercepat patch.
					</p>
				</div>
				<div class="h-[600px] w-full relative bg-[var(--color-background-ds)]">
					<VueFlow
						:nodes="flowNodes"
						:edges="flowEdges"
						:fit-view-on-init="true"
						:min-zoom="0.3"
						:max-zoom="2"
						class="bg-[var(--color-background-soft)]"
						@node-click="handleNodeClick"
					>
						<template #node-process-stage="nodeProps">
							<ProcessStageNode v-bind="nodeProps" />
						</template>
						<Background pattern-color="rgba(148, 163, 184, 0.4)" :gap="16" />
						<MiniMap
							:pannable="true"
							:zoomable="true"
							node-color="#10b981"
							mask-color="rgba(240, 243, 248, 0.6)"
						/>
						<Controls position="bottom-right" />
					</VueFlow>
				</div>
			</div>

			<div
				v-if="activeStep"
				class="overflow-hidden rounded-lg border border-[var(--color-border-ds)] bg-white"
			>
				<div
					class="border-b border-[var(--color-border-ds)] bg-[var(--color-background-soft)] px-3 py-2.5"
				>
					<p
						class="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
					>
						Stage {{ stepIndex + 1 }} / {{ stages.length }}
					</p>
					<h3 class="m-0 mt-0.5 text-[0.95rem] font-bold text-[var(--color-text-ds)]">
						{{ activeStep.title }}
					</h3>
					<p class="m-0 mt-1 text-[0.8rem] text-[var(--color-text-dim)]">
						{{ activeStep.summary }}
					</p>
				</div>

				<div class="grid gap-0 md:grid-cols-2">
					<section
						class="border-b border-[var(--color-border-ds)] md:border-b-0 md:border-r"
					>
						<header
							class="border-b border-[var(--color-border-ds)] bg-[var(--color-background-soft)] px-3 py-2"
						>
							<p
								class="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
							>
								{{ activeStep.leftTitle }}
							</p>
						</header>
						<ol class="m-0 max-h-[260px] list-none overflow-auto p-0">
							<li
								v-for="line in activeStep.diffLines"
								:key="`${activeStep.key}-left-${line.line}`"
								class="grid grid-cols-[40px_1fr] gap-2 px-3 py-1 font-mono text-[0.72rem] leading-relaxed"
								:class="processDiffLineClass(line.status, 'left')"
							>
								<span class="text-right text-[var(--color-text-faint)]">{{
									line.line
								}}</span>
								<pre class="m-0 whitespace-pre-wrap break-words">{{
									line.left || ' '
								}}</pre>
							</li>
						</ol>
					</section>

					<section>
						<header
							class="border-b border-[var(--color-border-ds)] bg-[var(--color-background-soft)] px-3 py-2"
						>
							<p
								class="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
							>
								{{ activeStep.rightTitle }}
							</p>
						</header>
						<ol class="m-0 max-h-[260px] list-none overflow-auto p-0">
							<li
								v-for="line in activeStep.diffLines"
								:key="`${activeStep.key}-right-${line.line}`"
								class="grid grid-cols-[40px_1fr] gap-2 px-3 py-1 font-mono text-[0.72rem] leading-relaxed"
								:class="processDiffLineClass(line.status, 'right')"
							>
								<span class="text-right text-[var(--color-text-faint)]">{{
									line.line
								}}</span>
								<pre class="m-0 whitespace-pre-wrap break-words">{{
									line.right || ' '
								}}</pre>
							</li>
						</ol>
					</section>
				</div>
			</div>
		</div>
	</article>
</template>
