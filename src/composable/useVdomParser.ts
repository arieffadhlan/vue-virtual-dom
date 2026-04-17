import { shallowRef } from 'vue'
import { compile, NodeTypes, parse, type CompilerError } from '@vue/compiler-dom'
import type {
	DirectiveNode,
	ElementNode,
	IfBranchNode,
	InterpolationNode,
	RootNode,
	SimpleExpressionNode,
	TemplateChildNode,
} from '@vue/compiler-core'
import { PATCH_FLAG_LABELS } from '@/app/constants/vdom.constants'
import type {
	NodeClassification,
	VDomFlowEdge,
	VDomFlowNode,
	VDomParseResult,
} from '@/app/types/vdom.type'

interface PatchFlagMeta {
	value: number | null
	text: string | null
}

interface NodePresentationMeta {
	tagName: string | null
	expression: string | null
	textContent: string | null
	directiveNames: string[]
	attributeNames: string[]
	hasDynamicBindings: boolean
	sourcePreview: string
}

type TraversableNode = RootNode | TemplateChildNode | IfBranchNode | SimpleExpressionNode
type NestedTraversableNode = TemplateChildNode | IfBranchNode | SimpleExpressionNode

function compactWhitespace(input: string): string {
	return input.replace(/\s+/g, ' ').trim()
}

function truncateText(input: string, maxLength = 44): string {
	if (input.length <= maxLength) {
		return input
	}

	return `${input.slice(0, maxLength - 1)}…`
}

function parseInterpolationExpression(node: InterpolationNode): string {
	if (node.content.type === NodeTypes.SIMPLE_EXPRESSION) {
		return compactWhitespace(node.content.content)
	}

	const source = node.loc.source.replace(/^\{\{/, '').replace(/\}\}$/, '').trim()

	return compactWhitespace(source)
}

function parseDirectiveName(directive: DirectiveNode): string {
	const argument =
		directive.arg?.type === NodeTypes.SIMPLE_EXPRESSION
			? compactWhitespace(directive.arg.content)
			: null

	if (directive.name === 'bind' && argument) {
		return `v-bind:${argument}`
	}

	if (directive.name === 'on' && argument) {
		return `v-on:${argument}`
	}

	if (directive.name === 'slot' && argument) {
		return `v-slot:${argument}`
	}

	return `v-${directive.name}`
}

function parseElementMeta(node: ElementNode): {
	directiveNames: string[]
	attributeNames: string[]
	hasDynamicBindings: boolean
} {
	const directiveNames: string[] = []
	const attributeNames: string[] = []

	for (const property of node.props) {
		if (property.type === NodeTypes.DIRECTIVE) {
			directiveNames.push(parseDirectiveName(property))
			continue
		}

		attributeNames.push(property.name)
	}

	return {
		directiveNames,
		attributeNames,
		hasDynamicBindings: directiveNames.length > 0,
	}
}

function extractNodePresentationMeta(node: TraversableNode): NodePresentationMeta {
	const sourcePreview = truncateText(compactWhitespace(node.loc.source))

	switch (node.type) {
		case NodeTypes.ELEMENT: {
			const elementMeta = parseElementMeta(node)

			return {
				tagName: node.tag,
				expression: null,
				textContent: null,
				directiveNames: elementMeta.directiveNames,
				attributeNames: elementMeta.attributeNames,
				hasDynamicBindings: elementMeta.hasDynamicBindings,
				sourcePreview,
			}
		}
		case NodeTypes.INTERPOLATION:
			return {
				tagName: null,
				expression: parseInterpolationExpression(node),
				textContent: null,
				directiveNames: [],
				attributeNames: [],
				hasDynamicBindings: true,
				sourcePreview,
			}
		case NodeTypes.SIMPLE_EXPRESSION:
			return {
				tagName: null,
				expression: compactWhitespace(node.content),
				textContent: null,
				directiveNames: [],
				attributeNames: [],
				hasDynamicBindings: !node.isStatic,
				sourcePreview,
			}
		case NodeTypes.TEXT:
			return {
				tagName: null,
				expression: null,
				textContent: compactWhitespace(node.content),
				directiveNames: [],
				attributeNames: [],
				hasDynamicBindings: false,
				sourcePreview,
			}
		case NodeTypes.IF_BRANCH: {
			const branchCondition = node.condition
			const expression =
				branchCondition?.type === NodeTypes.SIMPLE_EXPRESSION
					? compactWhitespace(branchCondition.content)
					: branchCondition
						? truncateText(compactWhitespace(branchCondition.loc.source), 44)
						: 'else branch'

			return {
				tagName: null,
				expression,
				textContent: null,
				directiveNames: [],
				attributeNames: [],
				hasDynamicBindings: true,
				sourcePreview,
			}
		}
		case NodeTypes.FOR:
			return {
				tagName: null,
				expression: truncateText(compactWhitespace(node.loc.source), 44),
				textContent: null,
				directiveNames: [],
				attributeNames: [],
				hasDynamicBindings: true,
				sourcePreview,
			}
		default:
			return {
				tagName: null,
				expression: null,
				textContent: null,
				directiveNames: [],
				attributeNames: [],
				hasDynamicBindings: false,
				sourcePreview,
			}
	}
}

function isNestedTraversableNode(value: unknown): value is NestedTraversableNode {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		'loc' in value &&
		(value as { type: number }).type !== NodeTypes.ROOT &&
		typeof (value as { type: unknown }).type === 'number'
	)
}

function createNodeKey(node: TraversableNode): string | null {
	if (!node.loc) {
		return null
	}

	return `${node.loc.start.offset}:${node.loc.end.offset}`
}

function parsePatchFlagValue(rawFlag: string | null): number | null {
	if (!rawFlag) {
		return null
	}

	const flag = Number.parseInt(rawFlag, 10)
	return Number.isNaN(flag) ? null : flag
}

function parsePatchFlagText(rawFlag: string | null, value: number | null): string | null {
	if (!rawFlag) {
		return value === null ? null : (PATCH_FLAG_LABELS[value] ?? String(value))
	}

	const commentMatch = /\/\*\s*(.+?)\s*\*\//.exec(rawFlag)

	if (commentMatch?.[1]) {
		return commentMatch[1]
	}

	if (value !== null && PATCH_FLAG_LABELS[value]) {
		return PATCH_FLAG_LABELS[value]
	}

	return rawFlag.trim()
}

function extractPatchFlagRaw(node: TraversableNode): string | null {
	const candidate = (node as { codegenNode?: unknown }).codegenNode

	if (!candidate || typeof candidate !== 'object' || !('patchFlag' in candidate)) {
		return null
	}

	const rawPatchFlag = (candidate as { patchFlag?: unknown }).patchFlag

	if (typeof rawPatchFlag === 'string') {
		return rawPatchFlag
	}

	if (
		typeof rawPatchFlag === 'object' &&
		rawPatchFlag !== null &&
		'content' in rawPatchFlag &&
		typeof (rawPatchFlag as SimpleExpressionNode).content === 'string'
	) {
		return (rawPatchFlag as SimpleExpressionNode).content
	}

	return null
}

function collectChildren(node: TraversableNode): NestedTraversableNode[] {
	if (node.type === NodeTypes.IF) {
		return node.branches
	}

	if (node.type === NodeTypes.ROOT) {
		return node.children
	}

	if (node.type === NodeTypes.ELEMENT) {
		return node.children
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

	if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
		const childNodes: NestedTraversableNode[] = []

		for (const child of node.children) {
			if (isNestedTraversableNode(child)) {
				childNodes.push(child)
			}
		}

		return childNodes
	}

	if (node.type === NodeTypes.TEXT_CALL && isNestedTraversableNode(node.content)) {
		return [node.content]
	}

	return []
}

function astKind(node: TraversableNode): string {
	switch (node.type) {
		case NodeTypes.ROOT:
			return 'Root'
		case NodeTypes.ELEMENT:
			return 'Element'
		case NodeTypes.TEXT:
			return 'Text'
		case NodeTypes.COMMENT:
			return 'Comment'
		case NodeTypes.SIMPLE_EXPRESSION:
			return 'Expression'
		case NodeTypes.INTERPOLATION:
			return 'Interpolation'
		case NodeTypes.IF:
			return 'If'
		case NodeTypes.IF_BRANCH:
			return 'IfBranch'
		case NodeTypes.FOR:
			return 'For'
		default:
			return `Type-${node.type}`
	}
}

function labelFromNode(node: TraversableNode, nodeMeta: NodePresentationMeta): string {
	if (node.type === NodeTypes.ELEMENT) {
		return `<${node.tag}>`
	}

	if (node.type === NodeTypes.TEXT) {
		const compact = compactWhitespace(node.content)
		return compact.length > 0 ? truncateText(compact, 34) : '(whitespace)'
	}

	if (node.type === NodeTypes.INTERPOLATION) {
		const expression = nodeMeta.expression ?? '...'
		return `{{ ${truncateText(expression, 30)} }}`
	}

	if (node.type === NodeTypes.SIMPLE_EXPRESSION) {
		return truncateText(compactWhitespace(node.content), 34)
	}

	return astKind(node)
}

function classifyNode(
	node: TraversableNode,
	patchFlag: number | null,
	nodeMeta: NodePresentationMeta,
): NodeClassification {
	if (patchFlag !== null) {
		if (patchFlag === -1) {
			return 'static'
		}

		return 'dynamic'
	}

	if (nodeMeta.hasDynamicBindings) {
		return 'dynamic'
	}

	if (node.type === NodeTypes.INTERPOLATION) {
		return 'dynamic'
	}

	if (
		node.type === NodeTypes.IF ||
		node.type === NodeTypes.IF_BRANCH ||
		node.type === NodeTypes.FOR
	) {
		return 'dynamic'
	}

	if (node.type === NodeTypes.SIMPLE_EXPRESSION && !node.isStatic) {
		return 'dynamic'
	}

	return 'static'
}

function createCompilerError(error: CompilerError): Error {
	const start = error.loc?.start

	if (!start) {
		return new Error(error.message)
	}

	return new Error(`${error.message} (line ${start.line}, column ${start.column})`)
}

function buildPatchFlagMap(ast: RootNode): Map<string, PatchFlagMeta> {
	const patchFlags = new Map<string, PatchFlagMeta>()

	const visit = (node: TraversableNode): void => {
		const nodeKey = createNodeKey(node)
		const patchFlagRaw = extractPatchFlagRaw(node)
		const patchFlagValue = parsePatchFlagValue(patchFlagRaw)

		if (nodeKey && patchFlagRaw !== null) {
			patchFlags.set(nodeKey, {
				value: patchFlagValue,
				text: parsePatchFlagText(patchFlagRaw, patchFlagValue),
			})
		}

		for (const child of collectChildren(node)) {
			visit(child)
		}
	}

	visit(ast)
	return patchFlags
}

function buildFlowGraph(
	ast: RootNode,
	patchFlags: Map<string, PatchFlagMeta>,
): {
	nodes: VDomFlowNode[]
	edges: VDomFlowEdge[]
} {
	const nodes: VDomFlowNode[] = []
	const edges: VDomFlowEdge[] = []

	let sequence = 0
	let row = 0

	const visit = (
		node: TraversableNode,
		parentId: string | null,
		depth: number,
		treePath: string,
	): void => {
		const nodeId = `ast-${sequence++}`
		const nodeKey = createNodeKey(node)
		const patchMeta = nodeKey ? patchFlags.get(nodeKey) : undefined
		const patchFlag = patchMeta?.value ?? null
		const patchFlagText = patchMeta?.text ?? null
		const nodeMeta = extractNodePresentationMeta(node)
		const childNodes = collectChildren(node)
		const classification = classifyNode(node, patchFlag, nodeMeta)

		nodes.push({
			id: nodeId,
			type: 'ast',
			position: {
				x: depth * 280 + 24,
				y: row * 112 + 24,
			},
			data: {
				label: labelFromNode(node, nodeMeta),
				astKind: astKind(node),
				nodeTypeCode: node.type,
				depth,
				treePath,
				parentNodeId: parentId,
				childCount: childNodes.length,
				patchFlag,
				patchFlagText,
				classification,
				hasDynamicBindings: nodeMeta.hasDynamicBindings,
				tagName: nodeMeta.tagName,
				expression: nodeMeta.expression,
				textContent: nodeMeta.textContent,
				directiveNames: nodeMeta.directiveNames,
				attributeNames: nodeMeta.attributeNames,
				sourcePreview: nodeMeta.sourcePreview,
				startLine: node.loc.start.line,
				startColumn: node.loc.start.column,
				endLine: node.loc.end.line,
				endColumn: node.loc.end.column,
				source: node.loc.source,
			},
		})

		if (parentId) {
			edges.push({
				id: `${parentId}-${nodeId}`,
				source: parentId,
				target: nodeId,
				animated: classification === 'dynamic',
			})
		}

		row += 1

		for (const [index, child] of childNodes.entries()) {
			visit(child, nodeId, depth + 1, `${treePath}.${index}`)
		}
	}

	visit(ast, null, 0, '0')

	return {
		nodes,
		edges,
	}
}

export function useVdomParser() {
	const ast = shallowRef<RootNode | null>(null)
	const nodes = shallowRef<VDomFlowNode[]>([])
	const edges = shallowRef<VDomFlowEdge[]>([])

	function parseTemplate(template: string): VDomParseResult {
		const source = template.trim().length > 0 ? template : '<div />'

		const parsedAst = parse(source, {
			onError: (error) => {
				throw createCompilerError(error)
			},
		})

		const compiled = compile(source, {
			mode: 'function',
			hoistStatic: true,
			onError: (error) => {
				throw createCompilerError(error)
			},
		})

		const patchFlags = buildPatchFlagMap(compiled.ast)
		const graph = buildFlowGraph(parsedAst, patchFlags)

		ast.value = parsedAst
		nodes.value = graph.nodes
		edges.value = graph.edges

		return {
			ast: parsedAst,
			nodes: graph.nodes,
			edges: graph.edges,
		}
	}

	return {
		ast,
		nodes,
		edges,
		parseTemplate,
	}
}
