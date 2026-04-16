import Dexie, { type Table } from 'dexie'
import {
	DEFAULT_SNIPPET_NAME,
	DEFAULT_TEMPLATE,
	WORKSPACE_DB_NAME,
	WORKSPACE_DB_VERSION,
} from '@/app/constants/vdom.constants'
import type { TemplateSnippet } from '@/app/types/vdom.type'

class WorkspaceDatabase extends Dexie {
	snippets!: Table<TemplateSnippet, string>

	public constructor() {
		super(WORKSPACE_DB_NAME)
		this.version(WORKSPACE_DB_VERSION).stores({
			snippets: 'id, name, updatedAt, createdAt',
		})
		this.snippets = this.table('snippets')
	}
}

const workspaceDb = new WorkspaceDatabase()

function createSnippetId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	return `snippet-${Date.now()}`
}

function nowIso(): string {
	return new Date().toISOString()
}

async function ensureOpen(): Promise<void> {
	if (workspaceDb.isOpen()) {
		return
	}

	await workspaceDb.open()
}

export const workspaceRepository = {
	async listSnippets(): Promise<TemplateSnippet[]> {
		await ensureOpen()
		return workspaceDb.snippets.orderBy('updatedAt').reverse().toArray()
	},

	async getSnippet(id: string): Promise<TemplateSnippet | undefined> {
		await ensureOpen()
		return workspaceDb.snippets.get(id)
	},

	async createSnippet(
		name = DEFAULT_SNIPPET_NAME,
		template = DEFAULT_TEMPLATE,
	): Promise<TemplateSnippet> {
		await ensureOpen()

		const timestamp = nowIso()
		const snippet: TemplateSnippet = {
			id: createSnippetId(),
			name,
			template,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await workspaceDb.snippets.add(snippet)
		return snippet
	},

	async saveSnippet(
		payload: Pick<TemplateSnippet, 'id' | 'name' | 'template'>,
	): Promise<TemplateSnippet> {
		await ensureOpen()

		const current = await workspaceDb.snippets.get(payload.id)
		const timestamp = nowIso()

		const nextSnippet: TemplateSnippet = {
			id: payload.id,
			name: payload.name,
			template: payload.template,
			createdAt: current?.createdAt ?? timestamp,
			updatedAt: timestamp,
		}

		await workspaceDb.snippets.put(nextSnippet)
		return nextSnippet
	},

	async deleteSnippet(id: string): Promise<void> {
		await ensureOpen()
		await workspaceDb.snippets.delete(id)
	},

	close(): void {
		workspaceDb.close()
	},
}
