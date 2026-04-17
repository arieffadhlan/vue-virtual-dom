<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import Navbar from '@/components/app/Navbar.vue'
import Sidebar from '@/components/app/Sidebar.vue'

const isSidebarOpen = ref(false)

function toggleSidebar() {
	isSidebarOpen.value = !isSidebarOpen.value
}
</script>

<template>
	<div class="relative min-h-screen flex flex-col bg-[var(--color-background-ds)]">
		<Navbar @toggle-sidebar="toggleSidebar" />

		<div class="relative flex flex-1 justify-center overflow-hidden">
			<div class="relative flex h-full w-full max-w-[1280px] flex-1 overflow-hidden">
				<!-- Overlay Background -->
				<transition
					enter-active-class="transition-opacity duration-300 ease-out"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-200 ease-in"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<div
						v-if="isSidebarOpen"
						class="absolute inset-0 z-40 bg-[var(--color-text-ds)]/10 backdrop-blur-[2px]"
						@click="toggleSidebar"
					/>
				</transition>

				<!-- Sidebar Drawer -->
				<div
					class="absolute inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] transform transition-transform duration-300 ease-in-out shadow-[] bg-[var(--color-background-surface)] border-r border-[var(--color-border-ds)]"
					:class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
				>
					<Sidebar @close="toggleSidebar" />
				</div>

				<main class="flex-1 overflow-hidden p-4 lg:p-6 w-full flex flex-col">
					<RouterView />
				</main>
			</div>
		</div>
	</div>
</template>
