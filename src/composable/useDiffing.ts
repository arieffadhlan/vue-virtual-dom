import type { VDomDiffResult, VDomFlowNode } from '@/app/types/vdom.type'

export function useDiffing() {
	function diffNodes(previousNodes: VDomFlowNode[], nextNodes: VDomFlowNode[]): VDomDiffResult {
		const previousMap = new Map(previousNodes.map((node) => [node.id, node]))
		const nextMap = new Map(nextNodes.map((node) => [node.id, node]))

		const addedNodeIds = nextNodes
			.filter((node) => !previousMap.has(node.id))
			.map((node) => node.id)

		const removedNodeIds = previousNodes
			.filter((node) => !nextMap.has(node.id))
			.map((node) => node.id)

		const changedNodeIds = nextNodes
			.filter((node) => {
				const previousNode = previousMap.get(node.id)

				if (!previousNode) {
					return false
				}

				return (
					previousNode.data.patchFlag !== node.data.patchFlag ||
					previousNode.data.classification !== node.data.classification ||
					previousNode.data.label !== node.data.label
				)
			})
			.map((node) => node.id)

		return {
			addedNodeIds,
			removedNodeIds,
			changedNodeIds,
		}
	}

	return {
		diffNodes,
	}
}
