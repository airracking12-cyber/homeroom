// Usage: node scripts/admin-hash.mjs your-admin-password
// Prints the value to use for VITE_ADMIN_HASH.
import { createHash } from "node:crypto";
const pw = process.argv[2];
if (!pw) { console.error("Usage: node scripts/admin-hash.mjs <password>"); process.exit(1); }
console.log(createHash("sha256").update("hr-admin:" + pw).digest("hex"));
