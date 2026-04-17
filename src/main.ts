import { createApp } from 'vue'
import router from '@/router'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import 'primeicons/primeicons.css'
import '@/style/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

router.isReady().then(() => {
  app.mount('#app')
})
