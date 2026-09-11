import { createApp } from "../server/app";

const app = createApp();

export default (req: Request) => app.fetch(req);
