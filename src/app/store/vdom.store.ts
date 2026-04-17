import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch, type WatchStopHandle } from 'vue'
import type { RootNode } from '@vue/compiler-dom'
import {
	DEFAULT_SNIPPET_NAME,
	DEFAULT_TEMPLATE,
	VDOM_DEBOUNCE_MS,
} from '@/app/constants/vdom.constants'
import { workspaceRepository } from '@/app/api/workspace.db'
import type {
	TemplateSnippet,
	VDomDiffResult,
	VDomFlowEdge,
	VDomFlowNode,
	VDomFlowNodeData,
} from '@/app/types/vdom.type'
import { useDiffing } from '@/composable/useDiffing'
import { useVdomParser } from '@/composable/useVdomParser'
import { dayjs } from '@/libs/dayjs'
import { debounce } from '@/utils/debounce'

const EMPTY_DIFF_RESULT: VDomDiffResult = {
	addedNodeIds: [],
	removedNodeIds: [],
	changedNodeIds: [],
}

function byUpdatedAtDesc(a: TemplateSnippet, b: TemplateSnippet): number {
	if (a.updatedAt === b.updatedAt) {
		return 0
	}

	return a.updatedAt > b.updatedAt ? -1 : 1
}

export const useVdomStore = defineStore('vdom', () => {
	const parser = useVdomParser()
	const diffing = useDiffing()

	const templateSource = ref(DEFAULT_TEMPLATE)
	const ast = shallowRef<RootNode | null>(null)
	const flowNodes = shallowRef<VDomFlowNode[]>([])
	const flowEdges = shallowRef<VDomFlowEdge[]>([])
	const flowInstance = shallowRef<unknown | null>(null)

	const parseError = ref<string | null>(null)
	const isCompiling = ref(false)
	const snippets = ref<TemplateSnippet[]>([])
	const activeSnippetId = ref<string | null>(null)
	const selectedNodeId = ref<string | null>(null)
	const lastCompiledAt = ref<string | null>(null)
	const latestDiff = ref<VDomDiffResult>(EMPTY_DIFF_RESULT)

	const activeSnippet = computed(() => {
		if (!activeSnippetId.value) {
			return null
		}

		return snippets.value.find((snippet) => snippet.id === activeSnippetId.value) ?? null
	})

	const selectedNodeData = computed<VDomFlowNodeData | null>(() => {
		if (!selectedNodeId.value) {
			return null
		}

		return flowNodes.value.find((node) => node.id === selectedNodeId.value)?.data ?? null
	})

	const lastCompiledAtLabel = computed(() => {
		if (!lastCompiledAt.value) {
			return 'never'
		}

		return dayjs(lastCompiledAt.value).format('DD-MM-YYYY, HH:mm:ss')
	})

	let stopTemplateWatcher: WatchStopHandle | null = null

	const debouncedCompile = debounce((template: string) => {
		void compileTemplate(template)
	}, VDOM_DEBOUNCE_MS)

	function setTemplateSource(nextTemplate: string): void {
		templateSource.value = nextTemplate
	}

	function setFlowInstance(instance: unknown): void {
		flowInstance.value = instance
	}

	function selectNode(nodeId: string | null): void {
		selectedNodeId.value = nodeId
	}

	function startTemplateWatcher(): void {
		if (stopTemplateWatcher) {
			return
		}

		stopTemplateWatcher = watch(
			templateSource,
			(nextTemplate) => {
				debouncedCompile(nextTemplate)
			},
			{ immediate: true },
		)
	}

	function upsertSnippet(snippet: TemplateSnippet): void {
		const index = snippets.value.findIndex((currentSnippet) => currentSnippet.id === snippet.id)

		if (index < 0) {
			snippets.value = [snippet, ...snippets.value].sort(byUpdatedAtDesc)
			return
		}

		const nextSnippets = [...snippets.value]
		nextSnippets[index] = snippet
		snippets.value = nextSnippets.sort(byUpdatedAtDesc)
	}

	async function persistActiveSnippet(): Promise<void> {
		const snippetName = activeSnippet.value?.name ?? DEFAULT_SNIPPET_NAME

		if (!activeSnippetId.value) {
			const createdSnippet = await workspaceRepository.createSnippet(
				snippetName,
				templateSource.value,
			)
			activeSnippetId.value = createdSnippet.id
			upsertSnippet(createdSnippet)
			return
		}

		const savedSnippet = await workspaceRepository.saveSnippet({
			id: activeSnippetId.value,
			name: snippetName,
			template: templateSource.value,
		})

		upsertSnippet(savedSnippet)
	}

	async function hydrateSnippets(): Promise<void> {
		const savedSnippets = await workspaceRepository.listSnippets()

		if (savedSnippets.length === 0) {
			const createdSnippet = await workspaceRepository.createSnippet()
			snippets.value = [createdSnippet]
			activeSnippetId.value = createdSnippet.id
			templateSource.value = createdSnippet.template
			return
		}

		snippets.value = [...savedSnippets].sort(byUpdatedAtDesc)

		const selectedSnippet =
			savedSnippets.find((snippet) => snippet.id === activeSnippetId.value) ??
			savedSnippets[0]
		if (!selectedSnippet) {
			return
		}

		activeSnippetId.value = selectedSnippet.id
		templateSource.value = selectedSnippet.template
	}

	async function compileTemplate(template: string): Promise<void> {
		isCompiling.value = true
		parseError.value = null

		try {
			const previousNodes = flowNodes.value
			const previousSelectedTreePath = selectedNodeData.value?.treePath ?? null
			const previousSelectedNodeId = selectedNodeId.value
			const result = parser.parseTemplate(template)
			const nextNodeIds = new Set(result.nodes.map((node) => node.id))
			const nextNodeIdByTreePath = new Map(
				result.nodes.map((node) => [node.data.treePath, node.id] as const),
			)

			ast.value = result.ast
			flowNodes.value = result.nodes
			flowEdges.value = result.edges

			if (result.nodes.length === 0) {
				selectedNodeId.value = null
			} else if (previousSelectedTreePath) {
				const matchedNodeId = nextNodeIdByTreePath.get(previousSelectedTreePath)

				if (matchedNodeId) {
					selectedNodeId.value = matchedNodeId
				} else if (previousSelectedNodeId && nextNodeIds.has(previousSelectedNodeId)) {
					selectedNodeId.value = previousSelectedNodeId
				} else {
					selectedNodeId.value = null
				}
			} else if (
				!previousSelectedNodeId ||
				!nextNodeIds.has(previousSelectedNodeId)
			) {
				selectedNodeId.value = null
			}

			latestDiff.value = diffing.diffNodes(previousNodes, result.nodes)
			lastCompiledAt.value = new Date().toISOString()

			await persistActiveSnippet()
		} catch (error) {
			ast.value = null
			flowNodes.value = []
			flowEdges.value = []
			selectedNodeId.value = null
			latestDiff.value = EMPTY_DIFF_RESULT
			parseError.value = error instanceof Error ? error.message : 'Unknown compiler error'
		} finally {
			isCompiling.value = false
		}
	}

	async function initialize(): Promise<void> {
		await hydrateSnippets()
		startTemplateWatcher()
	}

	async function createSnippet(name: string): Promise<void> {
		const resolvedName = name.trim().length > 0 ? name.trim() : DEFAULT_SNIPPET_NAME
		const createdSnippet = await workspaceRepository.createSnippet(
			resolvedName,
			DEFAULT_TEMPLATE,
		)

		upsertSnippet(createdSnippet)
		activeSnippetId.value = createdSnippet.id
		selectedNodeId.value = null
		templateSource.value = createdSnippet.template
	}

	function selectSnippet(snippetId: string): void {
		const snippet = snippets.value.find((currentSnippet) => currentSnippet.id === snippetId)

		if (!snippet) {
			return
		}

		activeSnippetId.value = snippet.id
		selectedNodeId.value = null
		templateSource.value = snippet.template
	}

	async function renameActiveSnippet(nextName: string): Promise<void> {
		if (!activeSnippetId.value) {
			return
		}

		const currentSnippet = snippets.value.find(
			(snippet) => snippet.id === activeSnippetId.value,
		)

		if (!currentSnippet) {
			return
		}

		const resolvedName = nextName.trim().length > 0 ? nextName.trim() : currentSnippet.name
		const savedSnippet = await workspaceRepository.saveSnippet({
			id: currentSnippet.id,
			name: resolvedName,
			template: currentSnippet.template,
		})

		upsertSnippet(savedSnippet)
	}

	async function removeSnippet(snippetId: string): Promise<void> {
		await workspaceRepository.deleteSnippet(snippetId)
		snippets.value = snippets.value.filter((snippet) => snippet.id !== snippetId)
		if (selectedNodeId.value) {
			selectedNodeId.value = null
		}

		if (activeSnippetId.value === snippetId) {
			const fallbackSnippet = snippets.value[0]

			if (fallbackSnippet) {
				activeSnippetId.value = fallbackSnippet.id
				templateSource.value = fallbackSnippet.template
				return
			}

			const createdSnippet = await workspaceRepository.createSnippet()
			snippets.value = [createdSnippet]
			activeSnippetId.value = createdSnippet.id
			templateSource.value = createdSnippet.template
		}
	}

	function dispose(): void {
		if (stopTemplateWatcher) {
			stopTemplateWatcher()
			stopTemplateWatcher = null
		}

		debouncedCompile.cancel()
		workspaceRepository.close()
		flowInstance.value = null
	}

	return {
		templateSource,
		ast,
		flowNodes,
		flowEdges,
		flowInstance,
		parseError,
		isCompiling,
		snippets,
		activeSnippetId,
		activeSnippet,
		selectedNodeId,
		selectedNodeData,
		lastCompiledAt,
		lastCompiledAtLabel,
		latestDiff,
		initialize,
		setTemplateSource,
		setFlowInstance,
		selectNode,
		createSnippet,
		selectSnippet,
		renameActiveSnippet,
		removeSnippet,
		dispose,
	}
})
