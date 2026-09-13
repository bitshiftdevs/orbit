import { reactive } from "vue";

type BaseOptions = {
	title?: string;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
};

type PromptOptions = BaseOptions & {
	placeholder?: string;
	inputLabel?: string;
};

type DialogState = {
	open: boolean;
	message: string;
	hasInput: boolean;
	inputValue: string;
	inputLabel: string;
	placeholder: string;
	title: string;
	confirmText: string;
	cancelText: string;
	danger: boolean;
	resolve: ((v: boolean | string | null) => void) | null;
};

const state = reactive<DialogState>({
	open: false,
	message: "",
	hasInput: false,
	inputValue: "",
	inputLabel: "",
	placeholder: "",
	title: "Confirm",
	confirmText: "Confirm",
	cancelText: "Cancel",
	danger: false,
	resolve: null,
});

function open(message: string, opts: PromptOptions & { hasInput: boolean }): Promise<any> {
	state.open = true;
	state.message = message;
	state.hasInput = opts.hasInput;
	state.inputValue = "";
	state.inputLabel = opts.inputLabel ?? "";
	state.placeholder = opts.placeholder ?? "";
	state.title = opts.title ?? (opts.hasInput ? "Input required" : "Confirm");
	state.confirmText = opts.confirmText ?? (opts.hasInput ? "OK" : "Confirm");
	state.cancelText = opts.cancelText ?? "Cancel";
	state.danger = opts.danger ?? false;
	return new Promise((resolve) => {
		state.resolve = resolve;
	});
}

export function useConfirmDialog() {
	function confirm(message: string, opts: BaseOptions = {}): Promise<boolean> {
		return open(message, { ...opts, hasInput: false });
	}

	function prompt(message: string, opts: PromptOptions = {}): Promise<string | null> {
		return open(message, { ...opts, hasInput: true });
	}

	function _submit() {
		if (!state.resolve) return;
		state.resolve(state.hasInput ? state.inputValue : true);
		state.open = false;
		state.resolve = null;
	}

	function _cancel() {
		if (!state.resolve) return;
		state.resolve(state.hasInput ? null : false);
		state.open = false;
		state.resolve = null;
	}

	return { state, confirm, prompt, _submit, _cancel };
}
