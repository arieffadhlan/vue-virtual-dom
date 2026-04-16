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

export interface ProcessStageFlowNodeData {
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
		changes: ProcessNodeChanges,
	): ProcessFlowStage[] {
		const sourceLeft = beforeResult.source.length > 0 ? beforeResult.source : '(empty source)'
		const sourceRight = afterResult.source.length > 0 ? afterResult.source : '(empty source)'

		const sourceStage: ProcessStageDraft = {
			key: 'source-update',
			title: '1. Source Update',
			subtitle: 'Kode awal -> kode akhir',
			summary:
				'Scheduler menandai komponen dirty ketika source berubah. Perubahan ini memicu pipeline compiler dan render effect.',
			metric: `${countLines(sourceLeft)} lines -> ${countLines(sourceRight)} lines`,
			leftTitle: 'Kode Awal',
			rightTitle: 'Kode Akhir',
			leftText: sourceLeft,
			rightText: sourceRight,
		}

		const compileStage: ProcessStageDraft = {
			key: 'compile',
			title: '2. Compiler Phase',
			subtitle: 'AST sebelum vs sesudah',
			summary:
				'Vue mem-parse template menjadi AST, menerapkan transform, lalu menyiapkan metadata agar render/runtime bisa bekerja efisien.',
			metric: `AST ${beforeResult.astNodeCount} -> ${afterResult.astNodeCount}`,
			leftTitle: 'AST Summary (Awal)',
			rightTitle: 'AST Summary (Akhir)',
			leftText: beforeResult.astSummaryText,
			rightText: afterResult.astSummaryText,
		}

		const renderStage: ProcessStageDraft = {
			key: 'render',
			title: '3. Render Phase',
			subtitle: 'Render function sebelum vs sesudah',
			summary:
				'Render function dieksekusi oleh reactive effect untuk menghasilkan VNode tree baru yang merepresentasikan state terbaru.',
			metric: `Render code ${beforeResult.renderLineCount} -> ${afterResult.renderLineCount} lines`,
			leftTitle: 'Render Function (Awal)',
			rightTitle: 'Render Function (Akhir)',
			leftText: beforeResult.renderCodeText,
			rightText: afterResult.renderCodeText,
		}

		const beforeSnapshot = toSnapshot(beforeResult.nodes)
		const afterSnapshot = toSnapshot(afterResult.nodes)
		const diffStage: ProcessStageDraft = {
			key: 'diff',
			title: '4. Diff Phase',
			subtitle: 'VNode lama vs VNode baru',
			summary: `Runtime membandingkan VNode tree: +${changes.added.length} added, ~${changes.changed.length} changed, -${changes.removed.length} removed.`,
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
			subtitle: 'Rencana mutasi DOM nyata',
			summary:
				'Patch engine commit hanya operasi yang diperlukan (insert/update/remove) supaya update DOM tetap minimal.',
			metric: `${changes.added.length + changes.changed.length + changes.removed.length} mutations`,
			leftTitle: 'Patch Plan',
			rightTitle: 'Patch Commit Result',
			leftText: patchPlan,
			rightText:
				changes.added.length + changes.changed.length + changes.removed.length > 0
					? `Commit ${changes.added.length + changes.changed.length + changes.removed.length} targeted mutation(s) into Real DOM.`
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

		const changes = diffSnapshots(toSnapshot(beforeResult.nodes), toSnapshot(afterResult.nodes))
		processStages.value = buildStages(beforeResult, afterResult, changes)
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

		if (processStepIndex.value >= processStages.value.length) {
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
			processStepIndex.value >= processStages.value.length - 1
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

		if (processStepIndex.value >= processStages.value.length - 1) {
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
			processStages.value.length - 1,
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

	function jumpToProcessStep(index: number): void {
		pauseProcessFlow()

		if (index < 0 || index >= processStages.value.length) {
			return
		}

		processStepIndex.value = index
	}

	function jumpToProcessStepByKey(stageKey: string): void {
		const index = processStages.value.findIndex((stage) => stage.key === stageKey)

		if (index < 0) {
			return
		}

		jumpToProcessStep(index)
	}

	const activeProcessStep = computed<ProcessFlowStage>(() => {
		return (
			processStages.value[processStepIndex.value] ??
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
		return processStages.value.map((stage, index) => ({
			id: stage.key,
			type: 'process-stage',
			position: {
				x: index * 258 + 24,
				y: index % 2 === 0 ? 28 : 112,
			},
			draggable: false,
			selectable: true,
			data: {
				index: index + 1,
				title: stage.title,
				subtitle: stage.subtitle,
				summary: stage.summary,
				metric: stage.metric,
				isActive: processStepIndex.value === index,
			},
		}))
	})

	const processFlowEdges = computed<Edge[]>(() => {
		const edges: Edge[] = []

		for (let index = 1; index < processStages.value.length; index += 1) {
			const sourceStage = processStages.value[index - 1]
			const targetStage = processStages.value[index]

			if (!sourceStage || !targetStage) {
				continue
			}

			edges.push({
				id: `${sourceStage.key}->${targetStage.key}`,
				source: sourceStage.key,
				target: targetStage.key,
				animated: processStepIndex.value >= index,
				style: {
					stroke: processStepIndex.value >= index ? '#10b981' : '#94a3b8',
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
