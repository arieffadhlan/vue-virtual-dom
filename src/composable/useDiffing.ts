import type { VDomDiffResult, VDomFlowNode } from '@/app/types/vdom.type'

export function useDiffing() {
	function hasNodeChanged(previousNode: VDomFlowNode, nextNode: VDomFlowNode): boolean {
		return (
			previousNode.data.patchFlag !== nextNode.data.patchFlag ||
			previousNode.data.classification !== nextNode.data.classification ||
			previousNode.data.label !== nextNode.data.label
		)
	}

	function diffNodes(previousNodes: VDomFlowNode[], nextNodes: VDomFlowNode[]): VDomDiffResult {
		const previousById = new Map(previousNodes.map((node) => [node.id, node]))
		const nextNodeIds = new Set<string>()

		const addedNodeIds: string[] = []
		const changedNodeIds: string[] = []

		for (const nextNode of nextNodes) {
			nextNodeIds.add(nextNode.id)
			const previousNode = previousById.get(nextNode.id)

			if (!previousNode) {
				addedNodeIds.push(nextNode.id)
				continue
			}

			if (hasNodeChanged(previousNode, nextNode)) {
				changedNodeIds.push(nextNode.id)
			}
		}

		const removedNodeIds: string[] = []

		for (const previousNode of previousNodes) {
			if (!nextNodeIds.has(previousNode.id)) {
				removedNodeIds.push(previousNode.id)
			}
		}

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
