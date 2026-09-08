import { ref, watchEffect } from "vue";

const STORAGE_KEY = "orbit-theme";

const isLight = ref(localStorage.getItem(STORAGE_KEY) === "light");

watchEffect(() => {
	document.documentElement.classList.toggle("light", isLight.value);
	localStorage.setItem(STORAGE_KEY, isLight.value ? "light" : "dark");
});

export function useTheme() {
	function toggle() {
		isLight.value = !isLight.value;
	}
	return { isLight, toggle };
}
