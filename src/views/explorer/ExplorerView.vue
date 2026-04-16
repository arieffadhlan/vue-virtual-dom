<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import type { Completion, CompletionSource } from '@codemirror/autocomplete'
import type { VDomFlowNode } from '@/app/types/vdom.type'
import { useVdomStore } from '@/app/store/vdom.store'
import { useVdomProcessFlow } from '@/composable/useVdomProcessFlow'
import ProcessFlowSection from '@/components/explorer/ProcessFlowSection.vue'
import CustomNode from '@/components/flow/CustomNode.vue'
import VNodeDetails from '@/components/flow/VNodeDetails.vue'
import type { EditorView as CodeMirrorEditorView } from 'codemirror'

const vdomStore = useVdomStore()
const editorElement = ref<HTMLDivElement | null>(null)
const flowPanelElement = ref<HTMLElement | null>(null)
const editorView = shallowRef<CodeMirrorEditorView | null>(null)
const isNativeFullscreen = ref(false)
const isFallbackFullscreen = ref(false)
const isGuideExpanded = ref(true)
const isDetailsExpanded = ref(true)
const processSourceBefore = ref('')
const processSourceAfter = computed({
	get: () => vdomStore.templateSource,
	set: (nextSource: string) => {
		vdomStore.setTemplateSource(nextSource)
	},
})
const isProcessSourceBeforeSeeded = ref(false)

const {
	isProcessExpanded,
	isProcessPlaying,
	processSpeedMs,
	processStepIndex,
	processError,
	processStages,
	activeStageIndex,
	activeProcessStep,
	processStats,
	processFlowNodes,
	processFlowEdges,
	toggleProcessPlayback,
	nextProcessStep,
	previousProcessStep,
	resetProcessStep,
	jumpToProcessStep,
	jumpToProcessStepByKey,
	stop: stopProcessFlow,
} = useVdomProcessFlow({
	sourceBefore: processSourceBefore,
	sourceAfter: processSourceAfter,
})

const isFlowFullscreen = computed(() => isNativeFullscreen.value || isFallbackFullscreen.value)

const graphStats = computed(() => {
	const allNodes = vdomStore.flowNodes
	const dynamicNodes = allNodes.filter((node) => node.data.classification === 'dynamic').length
	const staticNodes = allNodes.length - dynamicNodes
	const maxDepth = allNodes.reduce(
		(highestDepth, node) => Math.max(highestDepth, node.data.depth),
		0,
	)

	return {
		total: allNodes.length,
		dynamic: dynamicNodes,
		static: staticNodes,
		maxDepth,
	}
})

const guideItems = [
	{
		title: 'Tree Path',
		description: 'Alamat node di pohon AST. Contoh 0.1.2 artinya child ke-2 dari node 0.1.',
	},
	{
		title: 'Static Node',
		description:
			'Tidak membawa ketergantungan reaktif langsung. Umumnya tidak perlu update ulang saat state berubah.',
	},
	{
		title: 'Dynamic Node',
		description:
			'Membawa binding/ekspresi/percabangan/list rendering. Node ini berpotensi dipatch saat state berubah.',
	},
	{
		title: 'Max Depth',
		description:
			'Kedalaman terbesar dari node mana pun di tree. Semakin tinggi, semakin kompleks nested hirarkinya.',
	},
	{
		title: 'Classification',
		description:
			'static biasanya tidak berubah saat state update, dynamic berpotensi di-patch ulang.',
	},
	{
		title: 'Patch Flag',
		description:
			'Hint dari compiler agar renderer update bagian yang tepat tanpa kerja berlebih.',
	},
	{
		title: 'Source Range',
		description: 'Posisi line/column node pada template, membantu melacak asal perubahan.',
	},
]

type CodeMirrorModules = {
	core: typeof import('codemirror')
	htmlLang: typeof import('@codemirror/lang-html')
	autocomplete: typeof import('@codemirror/autocomplete')
}

let codeMirrorPromise: Promise<CodeMirrorModules> | null = null

async function loadCodeMirror() {
	if (!codeMirrorPromise) {
		codeMirrorPromise = Promise.all([
			import('codemirror'),
			import('@codemirror/lang-html'),
			import('@codemirror/autocomplete'),
		]).then(([core, htmlLang, autocomplete]) => ({
			core,
			htmlLang,
			autocomplete,
		}))
	}

	return codeMirrorPromise
}

function createTemplateCompletionSource(
	completeFromList: (list: readonly (string | Completion)[]) => CompletionSource,
): CompletionSource {
	return completeFromList([
		{ label: 'v-if', type: 'keyword', apply: 'v-if=""' },
		{ label: 'v-else', type: 'keyword', apply: 'v-else' },
		{ label: 'v-else-if', type: 'keyword', apply: 'v-else-if=""' },
		{ label: 'v-for', type: 'keyword', apply: 'v-for="item in items"' },
		{ label: 'v-bind', type: 'keyword', apply: 'v-bind:' },
		{ label: 'v-on', type: 'keyword', apply: 'v-on:' },
		{ label: ':class', type: 'property', apply: ':class=""' },
		{ label: ':style', type: 'property', apply: ':style=""' },
		{ label: '@click', type: 'property', apply: '@click=""' },
		{ label: '{{ expression }}', type: 'snippet', apply: '{{  }}' },
	])
}

function syncTemplateToEditor(nextTemplate: string): void {
	const currentEditor = editorView.value

	if (!currentEditor) {
		return
	}

	const currentDoc = currentEditor.state.doc.toString()

	if (currentDoc === nextTemplate) {
		return
	}

	currentEditor.dispatch({
		changes: {
			from: 0,
			to: currentDoc.length,
			insert: nextTemplate,
		},
	})
}

async function mountEditor(): Promise<void> {
	if (!editorElement.value || editorView.value) {
		return
	}

	const { core, htmlLang, autocomplete } = await loadCodeMirror()
	const { EditorView, basicSetup } = core
	const { html, htmlCompletionSource } = htmlLang
	const { autocompletion, completeFromList } = autocomplete
	const templateCompletionSource = createTemplateCompletionSource(completeFromList)

	editorView.value = new EditorView({
		doc: vdomStore.templateSource,
		extensions: [
			basicSetup,
			html({
				autoCloseTags: true,
			}),
			autocompletion({
				activateOnTyping: true,
				override: [htmlCompletionSource, templateCompletionSource],
			}),
			EditorView.updateListener.of((update) => {
				if (!update.docChanged) {
					return
				}

				vdomStore.setTemplateSource(update.state.doc.toString())
			}),
		],
		parent: editorElement.value,
	})
}

function handleNodeClick(payload: { node: VDomFlowNode }): void {
	vdomStore.selectNode(payload.node.id)
}

function handlePaneClick(): void {
	vdomStore.selectNode(null)
}

function handleSelectionChange(payload: { nodes?: VDomFlowNode[] }): void {
	const selectedNodeId = payload.nodes?.[0]?.id ?? null
	vdomStore.selectNode(selectedNodeId)
}

function handlePaneReady(instance: unknown): void {
	vdomStore.setFlowInstance(instance)
}

function handleProcessFlowNodeClick(stageKey: string): void {
	jumpToProcessStepByKey(stageKey)
}

function setProcessBeforeFromAfter(): void {
	processSourceBefore.value = processSourceAfter.value
}

function swapProcessSources(): void {
	const previousBefore = processSourceBefore.value
	processSourceBefore.value = processSourceAfter.value
	processSourceAfter.value = previousBefore
}

function updateProcessSourceBefore(nextSource: string): void {
	processSourceBefore.value = nextSource
}

function updateProcessSourceAfter(nextSource: string): void {
	processSourceAfter.value = nextSource
}

function updateProcessExpanded(nextExpanded: boolean): void {
	isProcessExpanded.value = nextExpanded
}

function updateProcessSpeed(nextSpeedMs: number): void {
	processSpeedMs.value = nextSpeedMs
}

async function fitFlowToView(): Promise<void> {
	const instance = vdomStore.flowInstance as {
		fitView?: (options?: Record<string, unknown>) => Promise<boolean> | boolean
	} | null

	if (!instance?.fitView) {
		return
	}

	await instance.fitView({
		padding: 0.18,
	})
}

function updateNativeFullscreenState(): void {
	isNativeFullscreen.value = document.fullscreenElement === flowPanelElement.value
}

async function toggleFlowFullscreen(): Promise<void> {
	const panelElement = flowPanelElement.value

	if (!panelElement) {
		return
	}

	if (panelElement.requestFullscreen) {
		if (document.fullscreenElement === panelElement) {
			await document.exitFullscreen()
			return
		}

		if (document.fullscreenElement) {
			await document.exitFullscreen()
		}

		await panelElement.requestFullscreen()
		return
	}

	isFallbackFullscreen.value = !isFallbackFullscreen.value
}

function handleWindowResize(): void {
	editorView.value?.requestMeasure()
}

function handleWindowKeydown(event: KeyboardEvent): void {
	if (event.key !== 'Escape') {
		return
	}

	if (isFallbackFullscreen.value) {
		isFallbackFullscreen.value = false
	}
}

const stopTemplateSync = watch(
	() => vdomStore.templateSource,
	(nextTemplate) => {
		syncTemplateToEditor(nextTemplate)
	},
)

const stopProcessSourceSeed = watch(
	() => vdomStore.templateSource,
	(nextTemplate) => {
		if (isProcessSourceBeforeSeeded.value) {
			return
		}

		processSourceBefore.value = nextTemplate
		isProcessSourceBeforeSeeded.value = true
	},
	{ immediate: true },
)

const stopFullscreenScroll = watch(isFlowFullscreen, (active) => {
	document.body.style.overflow = active ? 'hidden' : ''
})

onMounted(() => {
	void vdomStore.initialize()
	void mountEditor()
	window.addEventListener('resize', handleWindowResize)
	window.addEventListener('keydown', handleWindowKeydown)
	document.addEventListener('fullscreenchange', updateNativeFullscreenState)
})

onUnmounted(() => {
	stopProcessFlow()
	stopTemplateSync()
	stopProcessSourceSeed()
	stopFullscreenScroll()
	document.body.style.overflow = ''
	window.removeEventListener('resize', handleWindowResize)
	window.removeEventListener('keydown', handleWindowKeydown)
	document.removeEventListener('fullscreenchange', updateNativeFullscreenState)
	editorView.value?.destroy()
	editorView.value = null
	vdomStore.dispose()
})
</script>

<template>
	<section class="flex h-full flex-col gap-4">
		<!-- Panduan Belajar (Full Width Top) -->
		<article
			class="flex shrink-0 flex-col rounded-xl border border-[var(--color-border-ds)] bg-white shadow-sm transition-all duration-300"
		>
			<header
				class="flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--color-border-ds)] bg-[var(--color-background-ds)]/50 px-4 py-3"
				@click="isGuideExpanded = !isGuideExpanded"
			>
				<div>
					<h2
						class="m-0 flex items-center gap-2 text-[0.95rem] font-bold text-[var(--color-text-ds)]"
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
								d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
							/>
							<path d="M12 16v-4" />
							<path d="M12 8h.01" />
						</svg>
						Panduan Belajar
					</h2>
				</div>
				<button
					type="button"
					class="text-[var(--color-text-dim)] transition-transform duration-300 hover:text-[var(--color-brand)]"
					:class="{ 'rotate-180': isGuideExpanded }"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>
			</header>
			<div v-show="isGuideExpanded" class="bg-[var(--color-background-raised)]/20 p-4">
				<ul
					class="m-0 grid list-none grid-cols-1 gap-4 p-0 text-[0.78rem] md:grid-cols-2 xl:grid-cols-4"
				>
					<li
						v-for="item in guideItems"
						:key="item.title"
						class="group rounded-lg border border-[var(--color-border-ds)] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[var(--color-brand)]/40 hover:shadow-md"
					>
						<strong
							class="mb-1 block text-[0.82rem] text-[var(--color-text-ds)] transition-colors group-hover:text-[var(--color-brand)]"
							>{{ item.title }}</strong
						>
						<span class="leading-relaxed text-[var(--color-text-dim)]">{{
							item.description
						}}</span>
					</li>
				</ul>
			</div>
		</article>

		<!-- Template Editor (Full Width Middle) -->
		<article
			class="flex shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border-ds)] bg-white shadow-sm transition hover:shadow-md"
		>
			<header
				class="flex items-start justify-between gap-3 border-b border-[var(--color-border-ds)] bg-[var(--color-background-ds)]/50 px-4 py-3"
			>
				<div>
					<h2 class="m-0 text-[1rem] font-bold text-[var(--color-text-ds)]">
						Template Editor
					</h2>
					<p class="m-0 mt-0.5 text-[0.8rem] text-[var(--color-text-faint)]">
						Tulis template Vue. (Ctrl+Space) untuk autocomplete. Jangan word wrap.
					</p>
				</div>
			</header>
			<div
				ref="editorElement"
				class="editor-shell h-[240px] w-full max-w-[100vw] overflow-x-auto"
			/>
			<p
				class="m-0 border-t border-[var(--color-border-ds)] bg-[var(--color-background-raised)] px-4 py-2 text-[0.75rem] text-[var(--color-text-dim)]"
			>
				Auto-closing tag aktif. Suggestions: v-if, v-for, :class, dll. Scroll horizontal
				jika code panjang.
			</p>
			<p
				v-if="vdomStore.parseError"
				class="m-0 flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2.5 text-[0.8rem] font-semibold text-red-600"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				{{ vdomStore.parseError }}
			</p>
		</article>

		<ProcessFlowSection
			:is-expanded="isProcessExpanded"
			:source-before="processSourceBefore"
			:source-after="processSourceAfter"
			:process-error="processError"
			:stats="processStats"
			:is-playing="isProcessPlaying"
			:speed-ms="processSpeedMs"
			:step-index="activeStageIndex"
			:stages="processStages"
			:active-step="activeProcessStep"
			:flow-nodes="processFlowNodes"
			:flow-edges="processFlowEdges"
			@update:is-expanded="updateProcessExpanded"
			@update:source-before="updateProcessSourceBefore"
			@update:source-after="updateProcessSourceAfter"
			@set-before-from-after="setProcessBeforeFromAfter"
			@swap-sources="swapProcessSources"
			@toggle-playback="toggleProcessPlayback"
			@previous-step="previousProcessStep"
			@next-step="nextProcessStep"
			@reset-step="resetProcessStep"
			@jump-step="jumpToProcessStep"
			@update:speed-ms="updateProcessSpeed"
			@flow-node-click="handleProcessFlowNodeClick"
		/>
		<!-- Virtual DOM Graph & Details (Grid at Bottom) -->
		<div
			ref="flowPanelElement"
			class="grid min-h-[400px] flex-1 gap-4"
			:class="[
				isDetailsExpanded
					? 'grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_350px]'
					: 'grid-cols-1',
				{
					'fixed inset-3 z-50 rounded-xl bg-[var(--color-background-ds)] p-4 shadow-2xl':
						isFlowFullscreen,
				},
			]"
		>
			<!-- Flow Graph -->
			<article
				class="flow-panel flex flex-col overflow-hidden rounded-xl border border-[var(--color-border-ds)] bg-white shadow-sm transition hover:shadow-md"
				:class="{ 'border-none shadow-none': isFlowFullscreen }"
			>
				<header
					class="flex items-start justify-between gap-3 border-b border-[var(--color-border-ds)] bg-[var(--color-background-ds)]/50 px-4 py-3"
				>
					<div>
						<h2
							class="m-0 flex items-center gap-2 text-[1rem] font-bold text-[var(--color-text-ds)]"
						>
							Virtual DOM Graph
							<span
								v-if="!isDetailsExpanded"
								class="rounded-full border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/10 px-2 py-0.5 text-[0.75rem] font-normal text-[var(--color-brand)]"
								>Detail Minimized</span
							>
						</h2>
						<p class="m-0 mt-0.5 text-[0.8rem] text-[var(--color-text-faint)]">
							Visualisasi AST. Klik node untuk analisis detail.
						</p>
					</div>
					<div class="shrink-0 flex items-center gap-2">
						<button
							type="button"
							class="cursor-pointer rounded-lg border border-[var(--color-border-ds)] bg-white px-3 py-1.5 text-[0.78rem] font-bold text-[var(--color-text-dim)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-ds)]"
							@click="fitFlowToView"
						>
							Fit View
						</button>
						<button
							v-if="!isDetailsExpanded"
							type="button"
							class="cursor-pointer rounded-lg border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 px-3 py-1.5 text-[0.78rem] font-bold text-[var(--color-brand)] transition hover:bg-[var(--color-brand)] hover:text-white"
							@click="isDetailsExpanded = true"
						>
							Show Details
						</button>
						<button
							type="button"
							class="cursor-pointer rounded-lg border border-transparent bg-[var(--color-brand)] px-3 py-1.5 text-[0.78rem] font-bold text-white transition hover:bg-[var(--color-brand-surface)]"
							@click="toggleFlowFullscreen"
						>
							{{
								isFlowFullscreen ? 'Tutup Fullscreen' : 'Fullscreen Graph & Details'
							}}
						</button>
					</div>
				</header>

				<div
					class="flex flex-wrap gap-2 border-b border-[var(--color-border-ds)] bg-[var(--color-background-raised)]/50 px-4 py-2"
				>
					<p
						class="m-0 rounded-md border border-[var(--color-border-ds)] bg-white px-2 py-0.5 text-[0.72rem] font-bold text-[var(--color-text-dim)] shadow-sm"
						title="Jumlah semua node di AST saat ini."
					>
						Total:
						<span class="text-[var(--color-text-ds)]">{{ graphStats.total }}</span>
					</p>
					<p
						class="m-0 flex items-center gap-1 rounded-md border border-orange-200 bg-[var(--color-dynamic-node)] px-2 py-0.5 text-[0.72rem] font-bold text-orange-800 shadow-sm"
						title="Node reaktif yang mungkin dieksekusi saat render."
					>
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-orange-500"></span>
						Dynamic: {{ graphStats.dynamic }}
					</p>
					<p
						class="m-0 flex items-center gap-1 rounded-md border border-green-200 bg-[var(--color-static-node)] px-2 py-0.5 text-[0.72rem] font-bold text-green-800 shadow-sm"
						title="Node statis yang aman dari re-render."
					>
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
						Static: {{ graphStats.static }}
					</p>
					<p
						class="m-0 rounded-md border border-[var(--color-border-ds)] bg-white px-2 py-0.5 text-[0.72rem] font-bold text-[var(--color-text-dim)] shadow-sm"
					>
						Depth:
						<span class="text-[var(--color-text-ds)]">{{ graphStats.maxDepth }}</span>
					</p>
				</div>

				<div class="relative flex-1 overflow-hidden bg-[var(--color-background-ds)]">
					<VueFlow
						:nodes="vdomStore.flowNodes"
						:edges="vdomStore.flowEdges"
						fit-view-on-init
						class="flow-canvas h-full w-full"
						@node-click="handleNodeClick"
						@pane-click="handlePaneClick"
						@selection-change="handleSelectionChange"
						@pane-ready="handlePaneReady"
					>
						<template #node-ast="nodeProps">
							<CustomNode v-bind="nodeProps" />
						</template>
					</VueFlow>
				</div>
			</article>

			<!-- Details Sub Panel -->
			<article
				v-show="isDetailsExpanded"
				class="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-border-ds)] bg-white shadow-sm transition hover:shadow-md"
				:class="{ 'border-[var(--color-border-strong)]': isFlowFullscreen }"
			>
				<header
					class="shrink-0 flex items-center justify-between gap-3 border-b border-[var(--color-border-ds)] bg-[var(--color-background-ds)]/50 px-4 py-3"
				>
					<div>
						<h2
							class="m-0 flex items-center gap-2 text-[1rem] font-bold text-[var(--color-text-ds)]"
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
								<polygon points="12 2 2 7 12 12 22 7 12 2" />
								<polyline points="2 17 12 22 22 17" />
								<polyline points="2 12 12 17 22 12" />
							</svg>
							VNode Details
						</h2>
						<p class="m-0 mt-0.5 text-[0.8rem] text-[var(--color-text-faint)]">
							Atribut runtime node.
						</p>
					</div>
					<button
						type="button"
						class="rounded-md p-1 text-[var(--color-text-dim)] transition hover:bg-gray-200 hover:text-[var(--color-text-ds)]"
						@click="isDetailsExpanded = false"
						title="Minimize Details"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</header>
				<div class="flex-1 overflow-y-auto bg-[var(--color-background-ds)]/30">
					<div
						v-if="!vdomStore.selectedNodeData"
						class="flex h-full min-h-[140px] items-center justify-center px-6 text-center text-[0.85rem] text-[var(--color-text-faint)]"
					>
						<div class="flex flex-col items-center gap-2 opacity-70">
							<svg
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								class="text-[var(--color-text-dim)]"
							>
								<circle cx="12" cy="12" r="10"></circle>
								<line x1="12" y1="8" x2="12" y2="12"></line>
								<line x1="12" y1="16" x2="12.01" y2="16"></line>
							</svg>
							<span>Pilih node pada graph untuk melihat detailnya di sini.</span>
						</div>
					</div>
					<VNodeDetails v-else :node="vdomStore.selectedNodeData" />
				</div>
			</article>
		</div>
	</section>
</template>
