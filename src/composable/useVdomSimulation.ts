import { computed, ref, watch, type Ref } from 'vue'
import type { NodeClassification, VDomFlowNode, VDomSimulationMark } from '@/app/types/vdom.type'

export type SimulationPhaseKey = 'source-update' | 'compile' | 'render' | 'diff' | 'patch'

interface SimulationNodeSnapshot {
	id: string
	label: string
	treePath: string
	classification: NodeClassification
	patchFlagText: string | null
	astKind: string
}

export interface SimulationNodeChange {
	id: string | null
	treePath: string
	kind: 'added' | 'removed' | 'changed'
	beforeLabel: string | null
	afterLabel: string | null
}

export interface SimulationStep {
	key: SimulationPhaseKey
	title: string
	subtitle: string
	detail: string
}

interface SimulationCycle {
	id: number
	createdAt: string
	beforeCount: number
	afterCount: number
	added: SimulationNodeChange[]
	removed: SimulationNodeChange[]
	changed: SimulationNodeChange[]
	steps: SimulationStep[]
}

interface UseVdomSimulationOptions {
	flowNodes: Ref<VDomFlowNode[]>
	parseError: Ref<string | null>
	onFocusNode?: (nodeId: string) => void
}

export function useVdomSimulation({
	flowNodes,
	parseError,
	onFocusNode,
}: UseVdomSimulationOptions) {
	const isSimulationExpanded = ref(true)
	const isSimulationPlaying = ref(false)
	const simulationSpeedMs = ref(1100)
	const simulationStepIndex = ref(0)
	const simulationCycle = ref<SimulationCycle | null>(null)

	let simulationTimer: ReturnType<typeof setTimeout> | null = null
	let simulationCycleSequence = 0

	const baseSimulationSteps: SimulationStep[] = [
		{
			key: 'source-update',
			title: '1. Source Update',
			subtitle: 'Template berubah di editor',
			detail: 'Vue menerima perubahan source template dan menandai komponen agar render effect dijalankan ulang.',
		},
		{
			key: 'compile',
			title: '2. Compiler Phase',
			subtitle: 'Parse -> Transform -> Generate',
			detail: 'Compiler mem-parse template menjadi AST, transform node, lalu generate render function baru.',
		},
		{
			key: 'render',
			title: '3. Render Phase',
			subtitle: 'Render function menghasilkan VNode tree baru',
			detail: 'Reactive effect mengeksekusi render function untuk mendapatkan representasi Virtual DOM terbaru.',
		},
		{
			key: 'diff',
			title: '4. Diff Phase',
			subtitle: 'Bandingkan VNode lama vs baru',
			detail: 'Runtime mencari node yang ditambah, dihapus, atau berubah agar patch bisa tetap terarah dan hemat operasi.',
		},
		{
			key: 'patch',
			title: '5. Patch Commit',
			subtitle: 'Update DOM nyata',
			detail: 'Hanya bagian yang terdampak yang dipatch ke Real DOM, bukan render ulang seluruh tree.',
		},
	]

	const fallbackSimulationStep = baseSimulationSteps[0] as SimulationStep

	function toSimulationSnapshot(nodes: VDomFlowNode[]): SimulationNodeSnapshot[] {
		return nodes.map((node) => ({
			id: node.id,
			label: node.data.label,
			treePath: node.data.treePath,
			classification: node.data.classification,
			patchFlagText: node.data.patchFlagText,
			astKind: node.data.astKind,
		}))
	}

	function buildSimulationSteps(cycle: {
		beforeCount: number
		afterCount: number
		addedCount: number
		removedCount: number
		changedCount: number
	}): SimulationStep[] {
		const impactedCount = cycle.addedCount + cycle.removedCount + cycle.changedCount
		const firstMount = cycle.beforeCount === 0

		return [
			{
				key: 'source-update',
				title: '1. Source Update',
				subtitle: 'Template berubah di editor',
				detail: 'Source template berubah, lalu scheduler Vue menandai komponen untuk render ulang pada tick reaktif berikutnya.',
			},
			{
				key: 'compile',
				title: '2. Compiler Phase',
				subtitle: 'Parse -> Transform -> Generate',
				detail: `Compiler memetakan template ke AST baru dan menghasilkan render function. Kandidat dampak: ${impactedCount} node.`,
			},
			{
				key: 'render',
				title: '3. Render Phase',
				subtitle: 'Bentuk VNode tree baru',
				detail: firstMount
					? 'Render awal (mount): VNode tree pertama dibentuk dari source saat ini.'
					: `Render update: VNode baru dibuat untuk menggantikan baseline lama (${cycle.beforeCount} -> ${cycle.afterCount} node).`,
			},
			{
				key: 'diff',
				title: '4. Diff Phase',
				subtitle: 'Bandingkan VNode lama vs baru',
				detail: `Hasil diff: +${cycle.addedCount} added, ~${cycle.changedCount} changed, -${cycle.removedCount} removed.`,
			},
			{
				key: 'patch',
				title: '5. Patch Commit',
				subtitle: 'Mutasi Real DOM yang diperlukan',
				detail: 'Runtime commit patch ke DOM nyata hanya pada target yang berubah agar update efisien dan tidak repaint berlebih.',
			},
		]
	}

	function buildSimulationCycle(
		previousNodes: VDomFlowNode[],
		nextNodes: VDomFlowNode[],
	): SimulationCycle | null {
		if (parseError.value || nextNodes.length === 0) {
			return null
		}

		const previousSnapshot = toSimulationSnapshot(previousNodes)
		const nextSnapshot = toSimulationSnapshot(nextNodes)

		if (previousSnapshot.length === 0 && nextSnapshot.length === 0) {
			return null
		}

		const previousByPath = new Map(previousSnapshot.map((node) => [node.treePath, node]))
		const nextByPath = new Map(nextSnapshot.map((node) => [node.treePath, node]))

		const added: SimulationNodeChange[] = []
		const removed: SimulationNodeChange[] = []
		const changed: SimulationNodeChange[] = []

		for (const nextNode of nextSnapshot) {
			const previousNode = previousByPath.get(nextNode.treePath)

			if (!previousNode) {
				added.push({
					id: nextNode.id,
					treePath: nextNode.treePath,
					kind: 'added',
					beforeLabel: null,
					afterLabel: nextNode.label,
				})
				continue
			}

			const changedIdentity =
				previousNode.label !== nextNode.label ||
				previousNode.classification !== nextNode.classification ||
				previousNode.patchFlagText !== nextNode.patchFlagText ||
				previousNode.astKind !== nextNode.astKind

			if (changedIdentity) {
				changed.push({
					id: nextNode.id,
					treePath: nextNode.treePath,
					kind: 'changed',
					beforeLabel: previousNode.label,
					afterLabel: nextNode.label,
				})
			}
		}

		for (const previousNode of previousSnapshot) {
			if (nextByPath.has(previousNode.treePath)) {
				continue
			}

			removed.push({
				id: null,
				treePath: previousNode.treePath,
				kind: 'removed',
				beforeLabel: previousNode.label,
				afterLabel: null,
			})
		}

		const hasDiff = added.length + removed.length + changed.length > 0

		if (!hasDiff && previousSnapshot.length > 0) {
			return null
		}

		const steps = buildSimulationSteps({
			beforeCount: previousSnapshot.length,
			afterCount: nextSnapshot.length,
			addedCount: added.length,
			removedCount: removed.length,
			changedCount: changed.length,
		})

		simulationCycleSequence += 1

		return {
			id: simulationCycleSequence,
			createdAt: new Date().toISOString(),
			beforeCount: previousSnapshot.length,
			afterCount: nextSnapshot.length,
			added,
			removed,
			changed,
			steps,
		}
	}

	function clearSimulationTimer(): void {
		if (!simulationTimer) {
			return
		}

		clearTimeout(simulationTimer)
		simulationTimer = null
	}

	function pauseSimulation(): void {
		isSimulationPlaying.value = false
		clearSimulationTimer()
	}

	const simulationSteps = computed(() => simulationCycle.value?.steps ?? baseSimulationSteps)

	function scheduleSimulationTick(): void {
		clearSimulationTimer()

		if (!isSimulationPlaying.value) {
			return
		}

		const totalSteps = simulationSteps.value.length

		if (totalSteps === 0 || simulationStepIndex.value >= totalSteps - 1) {
			isSimulationPlaying.value = false
			return
		}

		simulationTimer = setTimeout(() => {
			simulationStepIndex.value += 1
			scheduleSimulationTick()
		}, simulationSpeedMs.value)
	}

	function startSimulation(): void {
		if (simulationSteps.value.length === 0) {
			return
		}

		if (simulationStepIndex.value >= simulationSteps.value.length - 1) {
			simulationStepIndex.value = 0
		}

		isSimulationPlaying.value = true
		scheduleSimulationTick()
	}

	function toggleSimulationPlayback(): void {
		if (isSimulationPlaying.value) {
			pauseSimulation()
			return
		}

		startSimulation()
	}

	function nextSimulationStep(): void {
		pauseSimulation()

		if (simulationSteps.value.length === 0) {
			return
		}

		simulationStepIndex.value = Math.min(
			simulationStepIndex.value + 1,
			simulationSteps.value.length - 1,
		)
	}

	function previousSimulationStep(): void {
		pauseSimulation()

		if (simulationSteps.value.length === 0) {
			return
		}

		simulationStepIndex.value = Math.max(simulationStepIndex.value - 1, 0)
	}

	function resetSimulation(): void {
		pauseSimulation()
		simulationStepIndex.value = 0
	}

	function jumpToSimulationStep(index: number): void {
		pauseSimulation()

		if (index < 0 || index >= simulationSteps.value.length) {
			return
		}

		simulationStepIndex.value = index
	}

	function focusSimulationNode(node: SimulationNodeChange): void {
		if (!node.id || !onFocusNode) {
			return
		}

		onFocusNode(node.id)
	}

	const activeSimulationStep = computed<SimulationStep>(
		() => simulationSteps.value[simulationStepIndex.value] ?? fallbackSimulationStep,
	)

	const simulationCounts = computed(() => {
		if (!simulationCycle.value) {
			return {
				before: 0,
				after: 0,
				added: 0,
				removed: 0,
				changed: 0,
			}
		}

		return {
			before: simulationCycle.value.beforeCount,
			after: simulationCycle.value.afterCount,
			added: simulationCycle.value.added.length,
			removed: simulationCycle.value.removed.length,
			changed: simulationCycle.value.changed.length,
		}
	})

	const simulationProgress = computed(() => {
		if (simulationSteps.value.length <= 1) {
			return 0
		}

		return (simulationStepIndex.value / (simulationSteps.value.length - 1)) * 100
	})

	const simulationImpactedNodes = computed(() => {
		if (!simulationCycle.value) {
			return [] as SimulationNodeChange[]
		}

		return [
			...simulationCycle.value.changed,
			...simulationCycle.value.added,
			...simulationCycle.value.removed,
		]
	})

	const simulationImpactedPreview = computed(() => simulationImpactedNodes.value.slice(0, 10))

	const simulationImpactedHiddenCount = computed(
		() => simulationImpactedNodes.value.length - simulationImpactedPreview.value.length,
	)

	const simulationNodeMarks = computed(() => {
		const markByNodeId = new Map<string, VDomSimulationMark>()

		if (!simulationCycle.value) {
			return markByNodeId
		}

		const step = activeSimulationStep.value
		const addedNodeIds = simulationCycle.value.added
			.map((node) => node.id)
			.filter((id): id is string => Boolean(id))
		const changedNodeIds = simulationCycle.value.changed
			.map((node) => node.id)
			.filter((id): id is string => Boolean(id))
		const impactedNodeIds = [...new Set([...addedNodeIds, ...changedNodeIds])]

		if (step.key === 'compile') {
			for (const nodeId of impactedNodeIds) {
				markByNodeId.set(nodeId, 'compile-target')
			}
		}

		if (step.key === 'render') {
			for (const nodeId of impactedNodeIds) {
				markByNodeId.set(nodeId, 'render-target')
			}
		}

		if (step.key === 'diff') {
			for (const nodeId of changedNodeIds) {
				markByNodeId.set(nodeId, 'diff-changed')
			}

			for (const nodeId of addedNodeIds) {
				markByNodeId.set(nodeId, 'diff-added')
			}
		}

		if (step.key === 'patch') {
			for (const nodeId of impactedNodeIds) {
				markByNodeId.set(nodeId, 'patch-commit')
			}
		}

		return markByNodeId
	})

	const flowNodesForView = computed<VDomFlowNode[]>(() => {
		return flowNodes.value.map((node) => {
			const nextMark = simulationNodeMarks.value.get(node.id) ?? 'none'

			if (node.data.simulationMark === nextMark) {
				return node
			}

			return {
				...node,
				data: {
					...node.data,
					simulationMark: nextMark,
				},
			}
		})
	})

	const stopSimulationCycleWatcher = watch(flowNodes, (nextNodes, previousNodes) => {
		const cycle = buildSimulationCycle(previousNodes, nextNodes)

		if (!cycle) {
			return
		}

		simulationCycle.value = cycle
		simulationStepIndex.value = 0
		startSimulation()
	})

	const stopSimulationSpeedWatcher = watch(simulationSpeedMs, () => {
		if (!isSimulationPlaying.value) {
			return
		}

		scheduleSimulationTick()
	})

	function stop(): void {
		pauseSimulation()
		stopSimulationCycleWatcher()
		stopSimulationSpeedWatcher()
	}

	return {
		isSimulationExpanded,
		isSimulationPlaying,
		simulationSpeedMs,
		simulationStepIndex,
		simulationSteps,
		activeSimulationStep,
		simulationCounts,
		simulationProgress,
		simulationImpactedPreview,
		simulationImpactedHiddenCount,
		flowNodesForView,
		toggleSimulationPlayback,
		nextSimulationStep,
		previousSimulationStep,
		resetSimulation,
		jumpToSimulationStep,
		focusSimulationNode,
		stop,
	}
}
