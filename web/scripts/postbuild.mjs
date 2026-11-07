// Next-Standalone: static + public hineinkopieren und /VERSION stempeln (PWA-Auto-Update)
import fs from "fs";
const sa = ".next/standalone";
fs.cpSync(".next/static", sa + "/.next/static", { recursive: true });
fs.cpSync("public", sa + "/public", { recursive: true });
const v = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
fs.writeFileSync(sa + "/public/VERSION", v + "\n");
fs.writeFileSync("public/VERSION", v + "\n");
console.log("VERSION", v);
