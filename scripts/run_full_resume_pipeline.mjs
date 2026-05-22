import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

// =====================================================
// CLI ARG HELPER
// =====================================================
function getArg(flag, def = "") {
  const i = process.argv.indexOf(flag);

  if (i === -1 || i === process.argv.length - 1) {
    return def;
  }

  return process.argv[i + 1];
}

// =====================================================
// COMMAND RUNNER
// =====================================================
function run(cmd, args, options = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);

  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    console.error(`❌ Command failed: ${cmd} ${args.join(" ")}`);

    process.exit(result.status || 1);
  }
}

// =====================================================
// MAIN PIPELINE
// =====================================================
async function main() {
  // ---------------------------------------------------
  // CLI INPUTS
  // ---------------------------------------------------
  const company = getArg("--company");
  const jobTitle = getArg("--job-title");
  const jobDescFile = getArg("--job-desc-file");

  const resumeMode = getArg("--resume-mode", "infra");

  const methods = getArg("--methods", "");

  if (!company || !jobTitle || !jobDescFile) {
    console.error(`
Usage:
node scripts/run_full_resume_pipeline.mjs \
  --company "Google" \
  --job-title "Senior Cloud Architect" \
  --job-desc-file jd.txt \
  [--resume-mode infra|dev|hybrid] \
  [--methods "Agile,FinOps,AI"]
`);

    process.exit(1);
  }

  // =====================================================
  // PHASE 1 — TAILORING
  // =====================================================
  run("node", [
    "scripts/tailor_resume.mjs",

    "--company",
    company,

    "--job-title",
    jobTitle,

    "--job-desc-file",
    jobDescFile,

    "--resume-mode",
    resumeMode,

    "--methods",
    methods,
  ]);

  // =====================================================
  // LOCATE LATEST GENERATED JOB FOLDER
  // =====================================================
  const jobsRoot = "jobs";

  if (!fs.existsSync(jobsRoot)) {
    console.error("❌ jobs directory not found.");

    process.exit(1);
  }

  // ---------------------------------------------------
  // Latest company folder
  // ---------------------------------------------------
  const companyFolders = fs
    .readdirSync(jobsRoot)
    .map(name => ({
      name,
      path: path.join(jobsRoot, name),
      stat: fs.statSync(path.join(jobsRoot, name)),
    }))
    .filter(x => x.stat.isDirectory())
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  if (!companyFolders.length) {
    console.error("❌ No company folders found.");

    process.exit(1);
  }

  const latestCompanyFolder = companyFolders[0].path;

  // ---------------------------------------------------
  // Latest role folder
  // ---------------------------------------------------
  const roleFolders = fs
    .readdirSync(latestCompanyFolder)
    .map(name => ({
      name,
      path: path.join(latestCompanyFolder, name),
      stat: fs.statSync(path.join(latestCompanyFolder, name)),
    }))
    .filter(x => x.stat.isDirectory())
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  if (!roleFolders.length) {
    console.error("❌ No role folders found.");

    process.exit(1);
  }

  const latestRoleFolder = roleFolders[0].path;

  // ---------------------------------------------------
  // Latest timestamp folder
  // ---------------------------------------------------
  const timestampFolders = fs
    .readdirSync(latestRoleFolder)
    .map(name => ({
      name,
      path: path.join(latestRoleFolder, name),
      stat: fs.statSync(path.join(latestRoleFolder, name)),
    }))
    .filter(x => x.stat.isDirectory())
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  if (!timestampFolders.length) {
    console.error("❌ No timestamp folders found.");

    process.exit(1);
  }

  const latestTimestampFolder = timestampFolders[0].path;

  // =====================================================
  // PHASE 1 OUTPUTS
  // =====================================================
  const rawFile = path.join(
    latestTimestampFolder,
    "raw.txt"
  );

  const phase2OutDir = path.join(
    latestTimestampFolder,
    "phase2"
  );

  if (!fs.existsSync(rawFile)) {
    console.error(`
❌ Could not find Phase-1 raw resume:

${rawFile}

Make sure tailor_resume.mjs generated raw.txt correctly.
`);

    process.exit(1);
  }

  // =====================================================
  // PHASE 2 — REVIEW + REFINEMENT
  // =====================================================
  run("node", [
    "scripts/refine_resume.mjs",

    "--job-desc-file",
    jobDescFile,

    "--raw-file",
    rawFile,

    "--out-dir",
    phase2OutDir,

    "--company",
    company,

    "--role",
    jobTitle,

    "--resume-mode",
    resumeMode,
  ]);

  // =====================================================
  // SUCCESS
  // =====================================================
  console.log("\n✅ Full resume pipeline completed successfully.");

  console.log(`\n📄 Phase-1 Raw Resume:
${rawFile}`);

  console.log(`\n📄 Phase-2 Refined Resume Folder:
${phase2OutDir}`);
}

// =====================================================
// ENTRY
// =====================================================
main().catch((err) => {
  console.error("\n❌ FATAL ERROR:");

  console.error(err);

  process.exit(1);
});
