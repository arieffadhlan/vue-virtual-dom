import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			name: 'explorer',
			component: () => import('@/views/explorer/ExplorerView.vue'),
		},
	],
})

export default router
