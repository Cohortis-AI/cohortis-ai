import { auth } from "@/lib/auth/config";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_USER = {
  id: DEV_USER_ID,
  name: "Dev User",
  email: "dev@cohortis.ai",
};

/**
 * Get the effective session.
 * In dev mode (DISABLE_AUTH=true), returns a fake session.
 */
export async function getEffectiveSession() {
  if (process.env.DISABLE_AUTH === "true") {
    return {
      user: DEV_USER,
      expires: new Date(Date.now() + 86400_000).toISOString(),
    };
  }

  return auth();
}

export { DEV_USER_ID };
