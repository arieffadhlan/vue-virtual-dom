import { compile, NodeTypes, type CompilerError } from '@vue/compiler-dom'
import type {
	DirectiveNode,
	ElementNode,
	IfBranchNode,
	RootNode,
	SimpleExpressionNode,
	TemplateChildNode,
} from '@vue/compiler-core'
import type { Edge, Node } from '@vue-flow/core'
import { computed, ref, watch, type Ref } from 'vue'
import type { VDomFlowNode } from '@/app/types/vdom.type'
import { useVdomParser } from '@/composable/useVdomParser'
import { debounce } from '@/utils/debounce'

export type ProcessPhaseKey = 'source-update' | 'compile' | 'render' | 'diff' | 'patch'
export type ProcessDiffLineStatus = 'same' | 'changed' | 'added' | 'removed'

type TraversableAstNode = RootNode | TemplateChildNode | IfBranchNode | SimpleExpressionNode

type ProcessNodeSnapshot = {
	treePath: string
	label: string
	classification: string
	patchFlagText: string | null
}

type ProcessChangedNode = {
	before: ProcessNodeSnapshot
	after: ProcessNodeSnapshot
}

type ProcessNodeChanges = {
	added: ProcessNodeSnapshot[]
	removed: ProcessNodeSnapshot[]
	changed: ProcessChangedNode[]
}

type TemplateAnalysisResult = {
	source: string
	normalizedSource: string
	nodes: VDomFlowNode[]
	astSummaryText: string
	renderCodeText: string
	astNodeCount: number
	renderLineCount: number
	error: string | null
}

type ProcessStageDraft = {
	key: ProcessPhaseKey
	title: string
	subtitle: string
	summary: string
	metric: string
	leftTitle: string
	rightTitle: string
	leftText: string
	rightText: string
}

export interface ProcessDiffLine {
	line: number
	left: string
	right: string
	status: ProcessDiffLineStatus
}

export interface ProcessFlowStage {
	key: ProcessPhaseKey
	title: string
	subtitle: string
	summary: string
	metric: string
	leftTitle: string
	rightTitle: string
	leftText: string
	rightText: string
	diffLines: ProcessDiffLine[]
}

export interface ProcessGraphNodeConfig {
	id: string
	stageKey: ProcessPhaseKey
	isMain: boolean
	title: string
	subtitle: string
	desc: string
}

export const detailedProcessNodes: ProcessGraphNodeConfig[] = [
	{
		id: '1-update',
		stageKey: 'source-update',
		isMain: true,
		title: '1. Source Update',
		subtitle: 'Kode Awal Berubah',
		desc: 'State/props berubah dan dependency reaktif memicu update untuk komponen terkait.',
	},
	{
		id: '1-mark',
		stageKey: 'source-update',
		isMain: false,
		title: 'Reactive Trigger',
		subtitle: 'Effect Ditandai Ulang',
		desc: 'Reactive effect yang bergantung pada state tersebut ditandai untuk dijalankan ulang.',
	},
	{
		id: '1-queue',
		stageKey: 'source-update',
		isMain: false,
		title: 'Scheduler Queue',
		subtitle: 'Microtask Queue',
		desc: 'Scheduler Vue membatch update dalam microtask agar render berulang pada tick sama bisa dihindari.',
	},

	{
		id: '2-compile',
		stageKey: 'compile',
		isMain: true,
		title: '2. Compile Phase',
		subtitle: 'Template -> Render Function',
		desc: 'Compile umumnya terjadi sekali: saat build (AOT) atau saat runtime compiler pertama kali memproses template. Pada update state biasa, tahap ini tidak diulang dari awal.',
	},
	{
		id: '2-parse',
		stageKey: 'compile',
		isMain: false,
		title: 'Parse Template',
		subtitle: 'Abstract Syntax Tree',
		desc: 'Compiler membangun AST dari elemen, atribut, dan interpolasi agar struktur template bisa dianalisis.',
	},
	{
		id: '2-transform',
		stageKey: 'compile',
		isMain: false,
		title: 'Transform & Hints',
		subtitle: 'Static Cache / Patch Flags',
		desc: 'Compiler menyiapkan cache static (hoist), patch flags, dan block metadata untuk jalur update runtime yang lebih cepat.',
	},
	{
		id: '2-generate',
		stageKey: 'compile',
		isMain: false,
		title: 'Codegen Render Function',
		subtitle: 'Runtime Input',
		desc: 'Output compile adalah fungsi render yang dipakai renderer untuk membuat VNode tree.',
	},

	{
		id: '3-render',
		stageKey: 'render',
		isMain: true,
		title: '3. Mount / Render Effect',
		subtitle: 'Eksekusi Render Function',
		desc: 'Renderer menjalankan render function di dalam reactive effect untuk menghasilkan VNode tree terbaru.',
	},
	{
		id: '3-vdom',
		stageKey: 'render',
		isMain: false,
		title: 'VNode Tree Creation',
		subtitle: 'UI Representation',
		desc: 'VNode disusun sebagai representasi virtual UI yang nanti dipakai untuk mount atau patch.',
	},

	{
		id: '4-diff',
		stageKey: 'diff',
		isMain: true,
		title: '4. Diff / Reconciliation',
		subtitle: 'Bandingkan VDOM',
		desc: 'Renderer membandingkan VNode tree lama dan baru untuk menentukan update minimum pada DOM nyata.',
	},
	{
		id: '4-fastpath',
		stageKey: 'diff',
		isMain: false,
		title: 'Compiler Fast Paths',
		subtitle: 'Patch Flags / Tree Flattening',
		desc: 'Dengan patch flags dan block tree flattening, runtime fokus pada dynamic descendants dan melewati bagian static.',
	},

	{
		id: '5-patch',
		stageKey: 'patch',
		isMain: true,
		title: '5. Patch Commit',
		subtitle: 'Apply DOM Updates',
		desc: 'Renderer menerapkan operasi host DOM seperlunya: insert, remove, move, update text, dan patch props.',
	},
	{
		id: '5-dom',
		stageKey: 'patch',
		isMain: false,
		title: 'Host Operations',
		subtitle: 'Minimal DOM Work',
		desc: 'Update dijalankan hanya pada node target yang berubah agar biaya patch tetap rendah.',
	},
	{
		id: '5-lifecycle',
		stageKey: 'patch',
		isMain: false,
		title: 'Post-flush Hooks',
		subtitle: 'updated / post watchers',
		desc: 'Setelah patch selesai, Vue menjalankan updated hooks dan watcher dengan flush post.',
	},
]
export interface ProcessStageFlowNodeData {
	isMain: boolean
	stageKey: ProcessPhaseKey
	index: number
	title: string
	subtitle: string
	summary: string
	metric: string
	isActive: boolean
}

export interface ProcessFlowStats {
	beforeNodeCount: number
	afterNodeCount: number
	addedCount: number
	removedCount: number
	changedCount: number
	mutationCount: number
	beforeLineCount: number
	afterLineCount: number
}

interface UseVdomProcessFlowOptions {
	sourceBefore: Ref<string>
	sourceAfter: Ref<string>
}

const FALLBACK_SOURCE = '<div />'
const PROCESS_STAGE_X_GAP = 350
const PROCESS_STAGE_Y_GAP = 216
const PROCESS_STAGE_CANVAS_PADDING = 24

function normalizeTemplateSource(source: string): string {
	return source.trim().length > 0 ? source : FALLBACK_SOURCE
}

function createCompilerError(error: CompilerError): Error {
	const start = error.loc?.start

	if (!start) {
		return new Error(error.message)
	}

	return new Error(`${error.message} (line ${start.line}, column ${start.column})`)
}

function isTraversableAstNode(
	value: unknown,
): value is TemplateChildNode | IfBranchNode | SimpleExpressionNode {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		'loc' in value &&
		typeof (value as { type: unknown }).type === 'number'
	)
}

function collectAstChildren(
	node: TraversableAstNode,
): (TemplateChildNode | IfBranchNode | SimpleExpressionNode)[] {
	if (node.type === NodeTypes.ROOT) {
		return node.children
	}

	if (node.type === NodeTypes.ELEMENT) {
		return node.children
	}

	if (node.type === NodeTypes.IF) {
		return node.branches
	}

	if (node.type === NodeTypes.IF_BRANCH) {
		return node.children
	}

	if (node.type === NodeTypes.FOR) {
		return node.children
	}

	if (node.type === NodeTypes.INTERPOLATION) {
		return [node.content]
	}

	if (node.type === NodeTypes.TEXT_CALL && isTraversableAstNode(node.content)) {
		return [node.content]
	}

	if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
		const nestedChildren: (TemplateChildNode | IfBranchNode | SimpleExpressionNode)[] = []

		for (const child of node.children) {
			if (isTraversableAstNode(child)) {
				nestedChildren.push(child)
			}
		}

		return nestedChildren
	}

	return []
}

function countElementDirectives(node: TraversableAstNode): number {
	if (node.type !== NodeTypes.ELEMENT) {
		return 0
	}

	return (node as ElementNode).props.filter(
		(property): property is DirectiveNode => property.type === NodeTypes.DIRECTIVE,
	).length
}

function summarizeAst(ast: RootNode): {
	nodeCount: number
	elementCount: number
	interpolationCount: number
	textCount: number
	ifCount: number
	forCount: number
	directiveCount: number
	maxDepth: number
} {
	let nodeCount = 0
	let elementCount = 0
	let interpolationCount = 0
	let textCount = 0
	let ifCount = 0
	let forCount = 0
	let directiveCount = 0
	let maxDepth = 0

	const visit = (node: TraversableAstNode, depth: number): void => {
		nodeCount += 1
		maxDepth = Math.max(maxDepth, depth)

		if (node.type === NodeTypes.ELEMENT) {
			elementCount += 1
			directiveCount += countElementDirectives(node)
		}

		if (node.type === NodeTypes.INTERPOLATION) {
			interpolationCount += 1
		}

		if (node.type === NodeTypes.TEXT) {
			textCount += 1
		}

		if (node.type === NodeTypes.IF || node.type === NodeTypes.IF_BRANCH) {
			ifCount += 1
		}

		if (node.type === NodeTypes.FOR) {
			forCount += 1
		}

		for (const child of collectAstChildren(node)) {
			visit(child, depth + 1)
		}
	}

	visit(ast, 0)

	return {
		nodeCount,
		elementCount,
		interpolationCount,
		textCount,
		ifCount,
		forCount,
		directiveCount,
		maxDepth,
	}
}

function toAstSummaryText(summary: {
	nodeCount: number
	elementCount: number
	interpolationCount: number
	textCount: number
	ifCount: number
	forCount: number
	directiveCount: number
	maxDepth: number
}): string {
	return [
		`Total nodes: ${summary.nodeCount}`,
		`Elements: ${summary.elementCount}`,
		`Interpolations: ${summary.interpolationCount}`,
		`Text nodes: ${summary.textCount}`,
		`Control flow blocks: if/branch ${summary.ifCount}, for ${summary.forCount}`,
		`Directives: ${summary.directiveCount}`,
		`Max depth: ${summary.maxDepth}`,
	].join('\n')
}

function toSnapshot(nodes: VDomFlowNode[]): ProcessNodeSnapshot[] {
	return nodes.map((node) => ({
		treePath: node.data.treePath,
		label: node.data.label,
		classification: node.data.classification,
		patchFlagText: node.data.patchFlagText,
	}))
}

function sortByTreePath(items: ProcessNodeSnapshot[]): ProcessNodeSnapshot[] {
	return [...items].sort((left, right) => left.treePath.localeCompare(right.treePath))
}

function diffSnapshots(
	beforeNodes: ProcessNodeSnapshot[],
	afterNodes: ProcessNodeSnapshot[],
): ProcessNodeChanges {
	const beforeByPath = new Map(beforeNodes.map((node) => [node.treePath, node]))
	const afterByPath = new Map(afterNodes.map((node) => [node.treePath, node]))

	const added: ProcessNodeSnapshot[] = []
	const removed: ProcessNodeSnapshot[] = []
	const changed: ProcessChangedNode[] = []

	for (const afterNode of afterNodes) {
		const beforeNode = beforeByPath.get(afterNode.treePath)

		if (!beforeNode) {
			added.push(afterNode)
			continue
		}

		const hasChanged =
			beforeNode.label !== afterNode.label ||
			beforeNode.classification !== afterNode.classification ||
			beforeNode.patchFlagText !== afterNode.patchFlagText

		if (hasChanged) {
			changed.push({
				before: beforeNode,
				after: afterNode,
			})
		}
	}

	for (const beforeNode of beforeNodes) {
		if (!afterByPath.has(beforeNode.treePath)) {
			removed.push(beforeNode)
		}
	}

	return {
		added: sortByTreePath(added),
		removed: sortByTreePath(removed),
		changed: [...changed].sort((left, right) =>
			left.after.treePath.localeCompare(right.after.treePath),
		),
	}
}

function toVNodeSnapshotText(nodes: ProcessNodeSnapshot[]): string {
	if (nodes.length === 0) {
		return 'No VNode snapshot available.'
	}

	return nodes
		.map((node) => {
			const patchMeta = node.patchFlagText ? ` | patch ${node.patchFlagText}` : ''
			return `${node.treePath.padEnd(7, ' ')} ${node.label} | ${node.classification}${patchMeta}`
		})
		.join('\n')
}

function toPatchPlanText(changes: ProcessNodeChanges): string {
	const operations: string[] = []

	for (const removedNode of changes.removed) {
		operations.push(`REMOVE path ${removedNode.treePath} -> ${removedNode.label}`)
	}

	for (const changedNode of changes.changed) {
		operations.push(
			`UPDATE path ${changedNode.after.treePath} -> ${changedNode.before.label} => ${changedNode.after.label}`,
		)
	}

	for (const addedNode of changes.added) {
		operations.push(`INSERT path ${addedNode.treePath} -> ${addedNode.label}`)
	}

	if (operations.length === 0) {
		return 'No DOM mutation is required. Existing DOM can be reused as-is.'
	}

	return operations.join('\n')
}

function toLineDiff(leftText: string, rightText: string, maxRows = 120): ProcessDiffLine[] {
	const leftLines = leftText.replace(/\r\n/g, '\n').split('\n')
	const rightLines = rightText.replace(/\r\n/g, '\n').split('\n')
	const maxLength = Math.max(leftLines.length, rightLines.length)
	const clippedLength = Math.min(maxLength, maxRows)
	const lines: ProcessDiffLine[] = []

	for (let index = 0; index < clippedLength; index += 1) {
		const left = leftLines[index] ?? ''
		const right = rightLines[index] ?? ''
		let status: ProcessDiffLineStatus = 'same'

		if (left === right) {
			status = 'same'
		} else if (left.length === 0 && right.length > 0) {
			status = 'added'
		} else if (left.length > 0 && right.length === 0) {
			status = 'removed'
		} else {
			status = 'changed'
		}

		lines.push({
			line: index + 1,
			left,
			right,
			status,
		})
	}

	if (maxLength > maxRows) {
		lines.push({
			line: maxRows + 1,
			left: '... output truncated for readability ...',
			right: '... output truncated for readability ...',
			status: 'same',
		})
	}

	return lines
}

function countLines(source: string): number {
	if (source.length === 0) {
		return 0
	}

	return source.replace(/\r\n/g, '\n').split('\n').length
}

function toRenderCode(normalizedSource: string): string {
	const compiled = compile(normalizedSource, {
		mode: 'function',
		hoistStatic: true,
		onError: (error) => {
			throw createCompilerError(error)
		},
	})

	return compiled.code
}

function createFallbackAnalysis(source: string, errorMessage: string): TemplateAnalysisResult {
	return {
		source,
		normalizedSource: normalizeTemplateSource(source),
		nodes: [],
		astSummaryText: `Compiler error\n${errorMessage}`,
		renderCodeText: `Compiler error\n${errorMessage}`,
		astNodeCount: 0,
		renderLineCount: 0,
		error: errorMessage,
	}
}

function toStageMetricMap(stages: ProcessFlowStage[]): Map<ProcessPhaseKey, string> {
	const metricByStageKey = new Map<ProcessPhaseKey, string>()

	for (const stage of stages) {
		metricByStageKey.set(stage.key, stage.metric)
	}

	return metricByStageKey
}

export function useVdomProcessFlow({ sourceBefore, sourceAfter }: UseVdomProcessFlowOptions) {
	const parser = useVdomParser()

	const isProcessExpanded = ref(true)
	const isProcessPlaying = ref(false)
	const processSpeedMs = ref(1300)
	const processStepIndex = ref(0)
	const processError = ref<string | null>(null)
	const processStages = ref<ProcessFlowStage[]>([])
	const processStats = ref<ProcessFlowStats>({
		beforeNodeCount: 0,
		afterNodeCount: 0,
		addedCount: 0,
		removedCount: 0,
		changedCount: 0,
		mutationCount: 0,
		beforeLineCount: 0,
		afterLineCount: 0,
	})

	let processTimer: ReturnType<typeof setTimeout> | null = null

	function clearProcessTimer(): void {
		if (!processTimer) {
			return
		}

		clearTimeout(processTimer)
		processTimer = null
	}

	function pauseProcessFlow(): void {
		isProcessPlaying.value = false
		clearProcessTimer()
	}

	function analyzeTemplate(source: string): TemplateAnalysisResult {
		try {
			const normalizedSource = normalizeTemplateSource(source)
			const parsedResult = parser.parseTemplate(normalizedSource)
			const astSummary = summarizeAst(parsedResult.ast)
			const renderCode = toRenderCode(normalizedSource)

			return {
				source,
				normalizedSource,
				nodes: parsedResult.nodes,
				astSummaryText: toAstSummaryText(astSummary),
				renderCodeText: renderCode,
				astNodeCount: astSummary.nodeCount,
				renderLineCount: countLines(renderCode),
				error: null,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown compiler error'
			return createFallbackAnalysis(source, errorMessage)
		}
	}

	function buildStages(
		beforeResult: TemplateAnalysisResult,
		afterResult: TemplateAnalysisResult,
		beforeSnapshot: ProcessNodeSnapshot[],
		afterSnapshot: ProcessNodeSnapshot[],
		changes: ProcessNodeChanges,
	): ProcessFlowStage[] {
		const sourceLeft = beforeResult.source.length > 0 ? beforeResult.source : '(empty source)'
		const sourceRight = afterResult.source.length > 0 ? afterResult.source : '(empty source)'

		const sourceStage: ProcessStageDraft = {
			key: 'source-update',
			title: '1. Source Update',
			subtitle: 'Kode awal -> kode akhir',
			summary:
				'Sumber perubahan memicu dependency reaktif, lalu scheduler membatch pekerjaan render effect dalam microtask.',
			metric: `${countLines(sourceLeft)} lines -> ${countLines(sourceRight)} lines`,
			leftTitle: 'Kode Awal',
			rightTitle: 'Kode Akhir',
			leftText: sourceLeft,
			rightText: sourceRight,
		}

		const compileStage: ProcessStageDraft = {
			key: 'compile',
			title: '2. Compile Phase',
			subtitle: 'AST sebelum vs sesudah',
			summary:
				'Compile berjalan lewat parse, transform, lalu codegen menjadi render function. Pada SFC + Vite/CLI biasanya terjadi saat build (AOT). Pada runtime compiler, compile biasanya terjadi sekali saat template pertama diproses. Pada update state normal, alur biasanya melompat ke render effect lalu patch.',
			metric: `AST ${beforeResult.astNodeCount} -> ${afterResult.astNodeCount}`,
			leftTitle: 'AST Summary (Awal)',
			rightTitle: 'AST Summary (Akhir)',
			leftText: beforeResult.astSummaryText,
			rightText: afterResult.astSummaryText,
		}

		const renderStage: ProcessStageDraft = {
			key: 'render',
			title: '3. Mount / Render Effect',
			subtitle: 'Render function sebelum vs sesudah',
			summary:
				'Renderer mengeksekusi render function sebagai reactive effect untuk menghasilkan VNode tree terbaru dari state saat ini.',
			metric: `Render code ${beforeResult.renderLineCount} -> ${afterResult.renderLineCount} lines`,
			leftTitle: 'Render Function (Awal)',
			rightTitle: 'Render Function (Akhir)',
			leftText: beforeResult.renderCodeText,
			rightText: afterResult.renderCodeText,
		}

		const diffStage: ProcessStageDraft = {
			key: 'diff',
			title: '4. Diff / Reconciliation',
			subtitle: 'VNode lama vs VNode baru',
			summary: `Runtime membandingkan VNode tree dengan fast path compiler-informed (patch flags / tree flattening): +${changes.added.length} added, ~${changes.changed.length} changed, -${changes.removed.length} removed.`,
			metric: `+${changes.added.length} ~${changes.changed.length} -${changes.removed.length}`,
			leftTitle: 'VNode Snapshot (Lama)',
			rightTitle: 'VNode Snapshot (Baru)',
			leftText: toVNodeSnapshotText(beforeSnapshot),
			rightText: toVNodeSnapshotText(afterSnapshot),
		}

		const patchPlan = toPatchPlanText(changes)
		const patchStage: ProcessStageDraft = {
			key: 'patch',
			title: '5. Patch Commit',
			subtitle: 'Commit mutasi DOM minimal',
			summary:
				'Patch commit menjalankan operasi host DOM seperlunya, lalu menyelesaikan antrian post-flush untuk hook/watcher terkait.',
			metric: `${changes.added.length + changes.changed.length + changes.removed.length} mutations`,
			leftTitle: 'Patch Plan',
			rightTitle: 'Patch Commit Result',
			leftText: patchPlan,
			rightText:
				changes.added.length + changes.changed.length + changes.removed.length > 0
					? `Commit ${changes.added.length + changes.changed.length + changes.removed.length} targeted host DOM mutation(s).`
					: 'No commit needed. DOM stays unchanged.',
		}

		return [sourceStage, compileStage, renderStage, diffStage, patchStage].map((stage) => ({
			...stage,
			diffLines: toLineDiff(stage.leftText, stage.rightText),
		}))
	}

	function recomputeProcessFlow(): void {
		const beforeResult = analyzeTemplate(sourceBefore.value)
		const afterResult = analyzeTemplate(sourceAfter.value)

		const errorMessages: string[] = []

		if (beforeResult.error) {
			errorMessages.push(`Kode awal: ${beforeResult.error}`)
		}

		if (afterResult.error) {
			errorMessages.push(`Kode akhir: ${afterResult.error}`)
		}

		processError.value = errorMessages.length > 0 ? errorMessages.join(' | ') : null

		const beforeSnapshot = toSnapshot(beforeResult.nodes)
		const afterSnapshot = toSnapshot(afterResult.nodes)
		const changes = diffSnapshots(beforeSnapshot, afterSnapshot)
		processStages.value = buildStages(
			beforeResult,
			afterResult,
			beforeSnapshot,
			afterSnapshot,
			changes,
		)
		processStats.value = {
			beforeNodeCount: beforeResult.nodes.length,
			afterNodeCount: afterResult.nodes.length,
			addedCount: changes.added.length,
			removedCount: changes.removed.length,
			changedCount: changes.changed.length,
			mutationCount: changes.added.length + changes.removed.length + changes.changed.length,
			beforeLineCount: countLines(beforeResult.source),
			afterLineCount: countLines(afterResult.source),
		}

		if (processStepIndex.value >= detailedProcessNodes.length) {
			processStepIndex.value = 0
		}
	}

	const debouncedRecompute = debounce(() => {
		recomputeProcessFlow()
	}, 220)

	function scheduleProcessTick(): void {
		clearProcessTimer()

		if (!isProcessPlaying.value) {
			return
		}

		if (
			processStages.value.length === 0 ||
			processStepIndex.value >= detailedProcessNodes.length - 1
		) {
			isProcessPlaying.value = false
			return
		}

		processTimer = setTimeout(() => {
			processStepIndex.value += 1
			scheduleProcessTick()
		}, processSpeedMs.value)
	}

	function startProcessFlow(): void {
		if (processStages.value.length === 0) {
			return
		}

		if (processStepIndex.value >= detailedProcessNodes.length - 1) {
			processStepIndex.value = 0
		}

		isProcessPlaying.value = true
		scheduleProcessTick()
	}

	function toggleProcessPlayback(): void {
		if (isProcessPlaying.value) {
			pauseProcessFlow()
			return
		}

		startProcessFlow()
	}

	function nextProcessStep(): void {
		pauseProcessFlow()

		if (processStages.value.length === 0) {
			return
		}

		processStepIndex.value = Math.min(
			processStepIndex.value + 1,
			detailedProcessNodes.length - 1,
		)
	}

	function previousProcessStep(): void {
		pauseProcessFlow()

		if (processStages.value.length === 0) {
			return
		}

		processStepIndex.value = Math.max(processStepIndex.value - 1, 0)
	}

	function resetProcessStep(): void {
		pauseProcessFlow()
		processStepIndex.value = 0
	}

	function jumpToProcessStep(stageIndex: number): void {
		pauseProcessFlow()

		const targetStage = processStages.value[stageIndex]
		if (!targetStage) return
		const index = detailedProcessNodes.findIndex((node) => node.stageKey === targetStage.key)
		if (index >= 0) {
			processStepIndex.value = index
		}
	}

	function jumpToProcessStepByKey(stageKeyOrNodeId: string): void {
		pauseProcessFlow()
		let index = detailedProcessNodes.findIndex((node) => node.id === stageKeyOrNodeId)
		if (index < 0) {
			index = detailedProcessNodes.findIndex((node) => node.stageKey === stageKeyOrNodeId)
		}
		if (index >= 0) {
			processStepIndex.value = index
		}
	}

	const activeStageIndex = computed<number>(() => {
		if (processStages.value.length === 0) return 0
		const def = detailedProcessNodes[processStepIndex.value]
		if (!def) return 0
		return Math.max(
			0,
			processStages.value.findIndex((s) => s.key === def.stageKey),
		)
	})

	const activeProcessStep = computed<ProcessFlowStage>(() => {
		return (
			processStages.value[activeStageIndex.value] ??
			processStages.value[0] ?? {
				key: 'source-update',
				title: '1. Source Update',
				subtitle: 'Kode awal -> kode akhir',
				summary: 'Belum ada data untuk dianalisis.',
				metric: 'N/A',
				leftTitle: 'Kode Awal',
				rightTitle: 'Kode Akhir',
				leftText: '',
				rightText: '',
				diffLines: [],
			}
		)
	})

	const processFlowNodes = computed<Node<ProcessStageFlowNodeData>[]>(() => {
		const metricByStageKey = toStageMetricMap(processStages.value)
		let currentMainIndex = -1
		let currentSubIndex = 0

		return detailedProcessNodes.map((def, index) => {
			if (def.isMain) {
				currentMainIndex++
				currentSubIndex = 0
			} else {
				currentSubIndex++
			}

			return {
				id: def.id,
				type: 'process-stage',
				position: {
					x: currentMainIndex * PROCESS_STAGE_X_GAP + PROCESS_STAGE_CANVAS_PADDING,
					y: currentSubIndex * PROCESS_STAGE_Y_GAP + PROCESS_STAGE_CANVAS_PADDING,
				},
				draggable: false,
				selectable: true,
				data: {
					index: index + 1,
					title: def.title,
					subtitle: def.subtitle,
					summary: def.desc,
					metric: metricByStageKey.get(def.stageKey) ?? 'N/A',
					isActive: processStepIndex.value === index,
					isMain: def.isMain,
					stageKey: def.stageKey,
				},
			}
		})
	})

	const processFlowEdges = computed<Edge[]>(() => {
		const edges: Edge[] = []

		for (let index = 1; index < detailedProcessNodes.length; index += 1) {
			const sourceNode = detailedProcessNodes[index - 1]!
			const targetNode = detailedProcessNodes[index]!

			if (!sourceNode || !targetNode) continue

			edges.push({
				id: `${sourceNode.id}->${targetNode.id}`,
				source: sourceNode.id,
				target: targetNode.id,
				animated: processStepIndex.value >= index,
				type: 'smoothstep',
				style: {
					stroke: processStepIndex.value >= index ? '#10b981' : '#cbd5e1',
					strokeWidth: 2.2,
				},
			})
		}

		return edges
	})

	const stopSourceWatcher = watch(
		[sourceBefore, sourceAfter],
		() => {
			debouncedRecompute()
		},
		{ immediate: true },
	)

	const stopSpeedWatcher = watch(processSpeedMs, () => {
		if (!isProcessPlaying.value) {
			return
		}

		scheduleProcessTick()
	})

	function stop(): void {
		pauseProcessFlow()
		debouncedRecompute.cancel()
		stopSourceWatcher()
		stopSpeedWatcher()
	}

	return {
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
		stop,
	}
}
