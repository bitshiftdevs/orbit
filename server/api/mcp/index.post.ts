import { createError } from "h3";
import {
	listProjects,
	getProject,
	listIssues,
	getIssue,
	createIssue,
	updateIssue,
	deleteIssue,
	addComment,
	getIssueLinks,
	addIssueLink,
	removeIssueLink,
	listSprints,
	createSprint,
	updateSprint,
	listTeam,
	search,
	getVelocity,
	getCycleTime,
	listSecrets,
	revealSecret,
	createSecret,
	updateSecret,
	deleteSecret,
	listEnvVars,
	revealEnvVar,
	setEnvVar,
	deleteEnvVar,
	exportDotenv,
	listFiles,
	deleteFile,
	getFileContent,
} from "./tools";

const TOOL_MAP: Record<string, (args: any, ctx: any) => Promise<any>> = {
	list_projects: listProjects,
	get_project: getProject,
	list_issues: listIssues,
	get_issue: getIssue,
	create_issue: createIssue,
	update_issue: updateIssue,
	delete_issue: deleteIssue,
	add_comment: addComment,
	get_issue_links: getIssueLinks,
	add_issue_link: addIssueLink,
	remove_issue_link: removeIssueLink,
	list_sprints: listSprints,
	create_sprint: createSprint,
	update_sprint: updateSprint,
	list_team: listTeam,
	search,
	get_velocity: getVelocity,
	get_cycle_time: getCycleTime,
	list_secrets: listSecrets,
	reveal_secret: revealSecret,
	create_secret: createSecret,
	update_secret: updateSecret,
	delete_secret: deleteSecret,
	list_env_vars: listEnvVars,
	reveal_env_var: revealEnvVar,
	set_env_var: setEnvVar,
	delete_env_var: deleteEnvVar,
	export_dotenv: exportDotenv,
	list_files: listFiles,
	delete_file: deleteFile,
	get_file_content: getFileContent,
};

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(
		event,
		async () => {
			const raw = await readBody(event);
			if (!raw || typeof raw !== "object") {
				throw createError({ statusCode: 400, statusMessage: "invalid request" });
			}
			return raw as Record<string, any>;
		},
	);

	const { method, params } = body as { method?: string; params?: any };
	if (!method || typeof method !== "string") {
		throw createError({ statusCode: 400, statusMessage: "invalid request" });
	}

	if (!TOOL_MAP[method]) {
		throw createError({ statusCode: 404, statusMessage: `unknown tool: ${method}` });
	}

	try {
		const result = await TOOL_MAP[method](params ?? {}, event);
		return {
			jsonrpc: "2.0",
			result,
			id: body.id ?? null,
		};
	} catch (err) {
		const message = !(err instanceof Error) ? "internal error" : err.message;
		throw createError({
			statusCode: (err as any).statusCode ?? 500,
			statusMessage: message,
		});
	}
});
