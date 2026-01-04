import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("home", "routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("settings", "routes/settings.tsx"),
  route("api/auth/*", "routes/api.auth.$.tsx"),
  route("api/auth/error", "routes/api.auth.error.tsx"),
  route("api/account/unlink", "routes/api.account.unlink.tsx"),
  route("api/account/delete", "routes/api.account.delete.tsx"),
  route("api/account/merge", "routes/api.account.merge.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
] satisfies RouteConfig;
