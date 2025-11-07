import { createRouter, createWebHistory } from "vue-router";
import SourcesPage from "./pages/SourcesPage.vue";
import TasksPage from "./pages/TasksPage.vue";
import ReviewPage from "./pages/ReviewPage.vue";
import UploadPage from "./pages/UploadPage.vue";
import LogsPage from "./pages/LogsPage.vue";
import SystemPage from "./pages/SystemPage.vue";

const routes = [
  { path: "/", redirect: "/sources" },
  { path: "/sources", component: SourcesPage },
  { path: "/tasks", component: TasksPage },
  { path: "/review", component: ReviewPage },
  { path: "/upload", component: UploadPage },
  { path: "/logs", component: LogsPage },
  { path: "/system", component: SystemPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

