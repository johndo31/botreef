export { resolveIdentity, createUserWithIdentity, linkIdentity, type ResolvedIdentity } from "./identity.js";
export { hasPermission, requirePermission, getUserRole, type Role } from "./rbac.js";
export { generateApiKey, saveApiKey, validateApiKey, rotateApiKey } from "./api-key.js";
