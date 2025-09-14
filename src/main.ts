import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { showNotification } from "./lib/notification";

const app = createApp(App);

app.use(router);
app.use(createPinia());
app.config.performance = true;
app.config.errorHandler = (err: any) => {
  console.error(err);
  showNotification(err.message, "error", err.error);
};

app.mount("#app");
