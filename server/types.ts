import { User } from "./db/schema";

export type AppEnv = {
  Variables: {
    user: User;
  };
};
