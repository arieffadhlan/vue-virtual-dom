import type { RootNode } from '@vue/compiler-dom'
import type { Edge, Node } from '@vue-flow/core'

export type NodeClassification = 'static' | 'dynamic'
export type VDomSimulationMark =
	| 'none'
	| 'compile-target'
	| 'render-target'
	| 'diff-added'
	| 'diff-changed'
	| 'patch-commit'

export interface VDomFlowNodeData {
	label: string
	astKind: string
	nodeTypeCode: number
	depth: number
	treePath: string
	parentNodeId: string | null
	childCount: number
	patchFlag: number | null
	patchFlagText: string | null
	classification: NodeClassification
	hasDynamicBindings: boolean
	tagName: string | null
	expression: string | null
	textContent: string | null
	directiveNames: string[]
	attributeNames: string[]
	sourcePreview: string
	startLine: number
	startColumn: number
	endLine: number
	endColumn: number
	source: string
	simulationMark?: VDomSimulationMark
}

export type VDomFlowNode = Node<VDomFlowNodeData> & {
	data: VDomFlowNodeData
}
export type VDomFlowEdge = Edge

export interface VDomParseResult {
	ast: RootNode
	nodes: VDomFlowNode[]
	edges: VDomFlowEdge[]
}

export interface TemplateSnippet {
	id: string
	name: string
	template: string
	createdAt: string
	updatedAt: string
}

export interface VDomDiffResult {
	addedNodeIds: string[]
	removedNodeIds: string[]
	changedNodeIds: string[]
}
