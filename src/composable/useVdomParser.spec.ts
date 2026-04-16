import { describe, expect, it } from 'vitest'
import { useVdomParser } from '@/composable/useVdomParser'

describe('useVdomParser', () => {
	it('maps template AST to VueFlow nodes and edges', () => {
		const parser = useVdomParser()
		const result = parser.parseTemplate('<div><p>{{ msg }}</p></div>')

		expect(result.nodes.length).toBeGreaterThan(0)
		expect(result.edges.length).toBeGreaterThan(0)

		const hasDynamicNode = result.nodes.some((node) => node.data.classification === 'dynamic')
		expect(hasDynamicNode).toBe(true)
	})
})
