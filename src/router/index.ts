import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
      meta: {
        title: "Home",
        description: "Home page of the project manager",
      },
    },
    {
      path: "/about",
      name: "about",
      component: () => import("../views/AboutView.vue"),
      meta: {
        title: "About",
        description: "About page of the project manager",
      },
    },
    {
      path: "/projects",
      name: "projects",
      component: () => import("../views/ProjectsView.vue"),
      meta: {
        title: "Projects",
        description: "Projects page of the project manager",
      },
    },
    {
      path: "/projects/:id",
      name: "project-details",
      component: () => import("../views/ProjectDetailsView.vue"),
      meta: {
        title: "Project Details",
        description: "Project Details page of the project manager",
      },
    },
    {
      path: "/portfolio",
      name: "portfolio",
      component: () => import("../views/PortfolioView.vue"),
      meta: {
        title: "Portfolio",
        description: "Portfolio page of the project manager",
      },
    },
    {
      path: "/feedback/:id",
      name: "client-feedback",
      component: () => import("../views/ClientFeedbackView.vue"),
      meta: {
        title: "Client Feedback",
        description: "Client Feedback page of the project manager",
      },
    },
    {
      path: "/clients",
      name: "clients",
      component: () => import("../views/ClientsView.vue"),
      meta: {
        title: "Clients",
        description: "Clients page of the project manager",
      },
    },
  ],
});

export default router;
