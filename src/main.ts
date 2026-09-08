import "./assets/main.css";
import "vue-sonner/style.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { notifyError } from "./lib/notify";

const app = createApp(App);
app.use(createPinia());
app.use(router);

app.config.errorHandler = (err) => {
	console.error(err);
	notifyError(err);
};

app.mount("#app");
