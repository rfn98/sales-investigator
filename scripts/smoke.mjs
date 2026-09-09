import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.env.SMOKE_PORT ?? "3100";
const base = `http://localhost:${port}`;

const mode = process.env.SMOKE_DEV ? ["dev", "-p", port] : ["start", "-p", port];
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...mode], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let logs = "";
child.stdout.on("data", (d) => { logs += d; });
child.stderr.on("data", (d) => { logs += d; });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(pathname) {
  const res = await fetch(base + pathname);
  const text = await res.text();
  return { status: res.status, text };
}

let exitCode = 0;

try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await wait(1500);
    try {
      const r = await get("/api/report");
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // server not up yet
    }
  }

  if (!ready) {
    console.log("SERVER NOT READY");
    console.log(logs.slice(0, 2000));
    exitCode = 1;
  } else {
    const report = await get("/api/report");
    const data = JSON.parse(report.text);
    console.log("API outlets:", data.outlets.length);
    console.log(
      "Declines:",
      data.outlets.filter((o) => o.status === "ANOMALY_DECLINE").map((o) => o.outletName).join(", "),
    );
    console.log(
      "Growth:",
      data.outlets.filter((o) => o.status === "ANOMALY_GROWTH").map((o) => o.outletName).join(", "),
    );
    console.log("Summary:", JSON.stringify(data.summary));
    console.log("Methodology keys:", Object.keys(data.methodology).join(","));

    const home = await get("/");
    console.log(
      "Home:",
      home.status,
      "bekasi:",
      home.text.includes("Bekasi"),
      "stockoutCard:",
      home.text.includes("INVENTORY SIGNALS"),
      "summaryCards:",
      home.text.includes("OUTLETS"),
    );

    const detail = await get("/outlets/outlet-bekasi?endDate=2026-09-07");
    console.log(
      "Detail:",
      detail.status,
      "runBtn:",
      detail.text.includes("Run Investigation"),
      "ctaCard:",
      detail.text.includes("Run AI investigation"),
      "zeroSales:",
      detail.text.includes("Zero sales verified"),
      "causeChain:",
      detail.text.includes("Cause chain"),
      "trend:",
      detail.text.includes("Revenue trend"),
      "productRows:",
      detail.text.includes("Dimsum"),
    );

    const bad = await get("/api/report?endDate=nope");
    console.log("BadDate HTTP:", bad.status);

    const notFound = await get("/outlets/outlet-zzz");
    console.log("Unknown outlet HTTP:", notFound.status);

    const invest = await get("/outlets/outlet-bekasi/investigate?endDate=2026-09-07");
    console.log(
      "Investigate:",
      invest.status,
      "dossierHeader:",
      invest.text.includes("AI INVESTIGATION"),
      "verdict:",
      invest.text.includes("INVESTIGATION VERDICT"),
      "attribution:",
      invest.text.includes("REVENUE ATTRIBUTION"),
      "whatWeKnow:",
      invest.text.includes("WHAT WE KNOW"),
      "recommendedActions:",
      invest.text.includes("Recommended actions"),
      "nextVectors:",
      invest.text.includes("Next vectors"),
      "evidenceGaps:",
      invest.text.includes("Evidence gaps"),
    );
  }
} catch (err) {
  console.error("SMOKE ERROR:", err);
  exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await wait(2500);
  process.exit(exitCode);
}