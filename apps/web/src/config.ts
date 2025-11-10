const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const appConfig = {
  apiUrl: required(import.meta.env.VITE_API_URL as string | undefined, "VITE_API_URL"),
  region: required(import.meta.env.VITE_REGION as string | undefined, "VITE_REGION"),
  userPoolId: required(
    import.meta.env.VITE_USER_POOL_ID as string | undefined,
    "VITE_USER_POOL_ID"
  ),
  userPoolClientId: required(
    import.meta.env.VITE_USER_POOL_CLIENT_ID as string | undefined,
    "VITE_USER_POOL_CLIENT_ID"
  )
};
