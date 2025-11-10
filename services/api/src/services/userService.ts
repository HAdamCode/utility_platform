import { z } from "zod";
import type { AuthContext } from "../auth.js";
import { ValidationError } from "../lib/errors.js";
import { UserStore } from "../data/userStore.js";
import type { UserProfile } from "../types.js";

const userStore = new UserStore();

const searchSchema = z.object({
  query: z.string().min(1).max(255)
});

export class UserService {
  async searchUsers(
    params: Record<string, string | undefined>,
    auth: AuthContext
  ): Promise<UserProfile[]> {
    await userStore.ensureUserProfile(auth);

    const parsed = searchSchema.safeParse({
      query: params.query ?? params.q
    });

    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    return userStore.searchUsers(parsed.data.query, 10);
  }
}
