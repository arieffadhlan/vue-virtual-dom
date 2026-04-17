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
import Button from '@/components/app/Button.vue'

const vdomStore = useVdomStore()
const editorElement = ref<HTMLDivElement | null>(null)
const flowPanelElement = ref<HTMLElement | null>(null)
const editorView = shallowRef<CodeMirrorEditorView | null>(null)
const isNativeFullscreen = ref(false)
const isDetailsExpanded = ref(true)
const processSourceBefore = ref('')
const processSourceAfter = computed({
	get: () => vdomStore.templateSource,
	set: (nextSource: string) => vdomStore.setTemplateSource(nextSource)
})

const isProcessSourceBeforeSeeded = ref(false)
const isFlowFullscreen = computed(() => isNativeFullscreen.value)

const graphStats = computed(() => {
	const allNodes = vdomStore.flowNodes
	let dynamicNodes = 0
	let maxDepth = 0

	for (const node of allNodes) {
		if (node.data.classification === 'dynamic') {
			dynamicNodes += 1
		}

		if (node.data.depth > maxDepth) {
			maxDepth = node.data.depth
		}
	}

	return {
		total  : allNodes.length,
		statics: allNodes.length - dynamicNodes,
		dynamic: dynamicNodes,
		maxDepth,
	}
})

const {
	processError,
	processStats,
	isProcessExpanded,
	activeProcessStep,
	processStages,
	isProcessPlaying,
	activeStageIndex,
	processFlowNodes,
	processFlowEdges,
	processSpeedMs,
	jumpToProcessStep,
	jumpToProcessStepByKey,
	nextProcessStep,
	previousProcessStep,
	resetProcessStep,
	toggleProcessPlayback,
	stop: stopProcessFlow,
} = useVdomProcessFlow({
	sourceBefore: processSourceBefore, sourceAfter: processSourceAfter
})

const guideItems = [
	{
		title: 'Abstract Syntax Tree (AST)',
		description: 'AST adalah representasi terstruktur dari template Vue dalam bentuk tree objek JavaScript. Setiap elemen, atribut, dan ekspresi template diubah menjadi "node" dalam pohon ini.',
	},
	{
		title: 'Render Function',
		description: 'Render function adalah fungsi JavaScript hasil compile dari template. Fungsi ini dipanggil oleh Vue renderer setiap kali komponen perlu dirender ulang, dan mengembalikan Virtual DOM tree (kumpulan VNode).',
	},
	{
		title: 'Virtual DOM Tree',
		description: 'Virtual DOM adalah representasi dari UI yang disimpan di memori JavaScript — bukan DOM nyata di browser. VDOM disusun sebagai tree VNode. Vue membandingkan tree lama vs tree baru untuk menentukan perubahan minimum yang perlu diterapkan ke DOM asli.',
	},
	{
		title: 'Dependency Tracking',
		description: 'Saat render function dijalankan dan membaca reactive state (misal ref atau reactive), Vue secara otomatis mencatat bahwa komponen ini "bergantung" pada state tersebut. Kalau state berubah, komponen ditandai untuk di-render ulang.',
	},
	{
		title: 'Scheduler Queue',
		description: 'Vue tidak langsung re-render saat state berubah. Update dijadwalkan dalam microtask queue. Artinya kalau kamu mengubah 5 state sekaligus dalam satu fungsi, Vue hanya akan render sekali setelah semua perubahan selesai — bukan 5 kali.',
	},
	{
		title: 'Patch Flags',
		description: 'Patch flags adalah angka numerik yang ditempel compiler pada VNode untuk memberi tahu runtime "bagian mana dari node ini yang bisa berubah." Saat patch, runtime tidak perlu memeriksa semua props — cukup cek yang ditandai saja.',
	},
	{
		title: 'Tree Flattening dan Block',
		description: 'Vue memperkenalkan konsep "block" — sebuah VNode khusus yang menyimpan daftar flat dari semua dynamic descendants-nya. Saat update, Vue bisa langsung patch daftar flat ini, tanpa perlu menelusuri seluruh tree secara rekursif.',
	},
	{
		title: 'Static Node dan Dynamic Node',
		description: 'Static node adalah elemen template yang tidak mengandung binding atau ekspresi — tidak akan pernah berubah. Dynamic node mengandung binding reaktif seperti :class, v-if, {{ expr }}, dan perlu dicek saat update. Static node di-hoist keluar dari render function agar tidak dibuat ulang setiap render.',
	},
	{
		title: 'Tree Path dan Source Range',
		description: 'Tree path adalah jalur posisi sebuah node di dalam hierarki AST — misalnya "anak ke-2 dari anak ke-0 dari root." Source range menyimpan informasi baris dan kolom dari kode sumber asli, berguna untuk error messages dan dev tools agar bisa menunjuk ke lokasi kode yang tepat.',
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
		{ label: ':class', type: 'property', apply: ':class=""' },
		{ label: ':style', type: 'property', apply: ':style=""' },
		{ label: '@click', type: 'property', apply: '@click=""' },
		{ label: 'v-on', type: 'keyword', apply: 'v-on:' },
		{ label: 'v-if', type: 'keyword', apply: 'v-if=""' },
		{ label: 'v-else-if', type: 'keyword', apply: 'v-else-if=""' },
		{ label: 'v-else', type: 'keyword', apply: 'v-else' },
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
		parent: editorElement.value,
		extensions: [
			basicSetup,
			EditorView.updateListener.of((update) => {
				if (!update.docChanged) {
					return
				}

				vdomStore.setTemplateSource(update.state.doc.toString())
			}),
			html({ autoCloseTags: true }),
			autocompletion({ activateOnTyping: true, override: [htmlCompletionSource, templateCompletionSource] }),
		],
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
}

function handleWindowResize(): void {
	editorView.value?.requestMeasure()
}

function handleWindowKeydown(event: KeyboardEvent): void {
	if (event.key !== 'Escape') {
		return
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
	<section class="w-full flex-col gap-4 flex h-full">
		<article class="flex flex-col rounded-xl border-[#D9D9D9] shrink-0 border shadow-sm overflow-hidden bg-white w-full">
			<div class="w-full flex-col justify-between items-start border-b border-[#D9D9D9] px-4 py-3 gap-1 flex">
				<div class="flex flex-row items-center gap-2">
					<i class="text-base text-black mt-[1px] pi pi-info-circle"></i>
					<p class="text-base font-bold">Panduan</p>
				</div>
			</div>
			<div class="w-fit bg-white p-4">
				<ul class="grid grid-cols-1 gap-4 list-none md:grid-cols-2 xl:grid-cols-3">
					<li v-for="item in guideItems" :key="item.title" class="rounded-lg border border-[#D9D9D9] bg-white p-3 shadow-sm">
						<p class="font-[700] text-sm leading-relaxed mb-1">{{ item.title }}</p>
						<p class="font-[400] text-sm leading-relaxed text-justify">
							{{ item.description }}
						</p>
					</li>
				</ul>
			</div>
		</article>
		<article class="flex flex-col rounded-xl border-[#D9D9D9] shrink-0 border shadow-sm overflow-hidden bg-white w-full">
			<div class="w-full flex-col justify-between items-start border-b border-[#D9D9D9] px-4 py-3 gap-1 flex">
				<p class="text-[16px] font-[700]">Template Editor</p>
				<p class="text-[14px] font-[400]">Tulis template Vue. <pre class="inline">(Ctrl+Space)</pre> untuk autocomplete.</p>
			</div>
			<div class="editor-shell h-[240px] w-full max-w-[100vw] overflow-auto" ref="editorElement" />
			<p v-if="vdomStore.parseError" class="m-0 flex border-t px-3.5 py-2.5 font-medium text-sm text-red-600 border-red-200 bg-red-50">
				{{ vdomStore.parseError }}
			</p>
		</article>
		<ProcessFlowSection
			:is-expanded="isProcessExpanded"
			:active-step="activeProcessStep"
			:stages="processStages"
			:source-before="processSourceBefore"
			:process-error="processError"
			:stats="processStats"
			:speed-ms="processSpeedMs"
			:source-after="processSourceAfter"
			:is-playing="isProcessPlaying"
			:step-index="activeStageIndex"
			:flow-nodes="processFlowNodes"
			:flow-edges="processFlowEdges"
			@update:speed-ms="processSpeedMs = $event"
			@update:is-expanded="isProcessExpanded = $event"
			@update:source-before="processSourceBefore = $event"
			@update:source-after="processSourceAfter = $event"
			@swap-sources="swapProcessSources"
			@toggle-playback="toggleProcessPlayback"
			@flow-node-click="handleProcessFlowNodeClick"
			@set-before-from-after="setProcessBeforeFromAfter"
			@reset-step="resetProcessStep"
			@previous-step="previousProcessStep"
			@next-step="nextProcessStep"
			@jump-step="jumpToProcessStep"
		/>
		<div ref="flowPanelElement" class="grid min-h-[400px] flex-1 gap-4" :class="[
				isDetailsExpanded
					? 'grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_350px]'
					: 'grid-cols-1',
				{
					'fixed inset-3 z-50 rounded-xl p-4 shadow-2xl bg-slate-100': isFlowFullscreen,
				},
			]"
		>
			<article class="flow-panel flex flex-col border-[#D9D9D9] border rounded-xl overflow-hidden bg-white shadow-sm">
				<div class="w-full flex-row gap-1 flex border-[#D9D9D9] border-b justify-between items-start px-4 py-3">
					<div class="flex flex-col gap-1">
						<p class="text-[16px] font-[700]">Virtual DOM	Tree</p>
						<p class="text-[14px] font-[400]">Visualisasi struktur AST. Klik pada node untuk untuk melihat detail lebih lengkap.</p>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" @click="fitFlowToView">Fit View</Button>
						<Button variant="primary" @click="isDetailsExpanded = true" v-if="!isDetailsExpanded">Show Details</Button>
						<Button variant="primary" @click="toggleFlowFullscreen">
							{{ isFlowFullscreen ? 'Tutup Fullscreen' : 'Fullscreen Window' }}
						</Button>
					</div>
				</div>
				<div class="flex flex-wrap gap-2 border-b border-[#D9D9D9] bg-white px-4 py-2.5">
					<p class="px-2 py-1 border border-zinc-800 rounded-md text-xs font-medium tracking-wide text-zinc-800 bg-zinc-300/10">Nodes: {{ graphStats.total }}</p>
					<p class="px-2 py-1 border border-zinc-800 rounded-md text-xs font-medium tracking-wide text-zinc-800 bg-zinc-300/10">Depth Level: {{ graphStats.maxDepth }}</p>
					<p class="px-2 py-1 border border-rose-800 rounded-md text-xs font-medium tracking-wide text-rose-800 bg-rose-300/10 items-center">Static: {{ graphStats.statics }}</p>
					<p class="px-2 py-1 border border-blue-800 rounded-md text-xs font-medium tracking-wide text-blue-800 bg-blue-300/10 items-center">
						Dynamic: {{ graphStats.dynamic }}
					</p>
				</div>
				<div class="relative flex-1 overflow-hidden bg-zinc-100">
					<VueFlow
						:nodes="vdomStore.flowNodes"
						:edges="vdomStore.flowEdges"
						fit-view-on-init
						class="flow-canvas h-full w-full"
						@pane-ready="handlePaneReady"
						@pane-click="handlePaneClick"
						@node-click="handleNodeClick"
						@selection-change="handleSelectionChange"
					>
						<template #node-ast="nodeProps">
							<CustomNode v-bind="nodeProps" />
						</template>
					</VueFlow>
				</div>
			</article>
			<article
				v-show="isDetailsExpanded"
				class="flex flex-col border-[#D9D9D9] border rounded-xl overflow-hidden bg-white shadow-sm"
			>
				<div class="w-full flex-row gap-1 flex border-[#D9D9D9] border-b justify-between items-start px-4 py-3">
					<div class="flex flex-col gap-1">
						<p class="text-[16px] font-[700]">VNode Details</p>
						<p class="text-[14px] font-[400]">Properti dan atribut runtime node terpilih.</p>
					</div>
					<button @click="isDetailsExpanded = false" class="cursor-pointer">
						<i class="pi pi-times text-sm" />
					</button>
				</div>
				<div class="flex-1 overflow-y-auto bg-white">
					<div v-if="!vdomStore.selectedNodeData" class="flex items-center justify-center min-h-[140px] h-full px-6 text-center">
						<div class="flex flex-col items-center gap-2">
							<p class="text-sm max-w-[240px]">Pilih node pada grafik untuk melihat detailnya di sini.</p>
						</div>
					</div>
					<VNodeDetails v-else :node="vdomStore.selectedNodeData" />
				</div>
			</article>
		</div>
	</section>
</template>
