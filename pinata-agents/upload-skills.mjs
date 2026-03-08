/**
 * Uploads all skill folders to Pinata IPFS and prints the new CIDs.
 *
 * Usage:
 *   PINATA_JWT=<your-jwt> node upload-skills.mjs
 *
 * Get your JWT from: https://app.pinata.cloud/developers/api-keys
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT = process.env.PINATA_JWT;

if (!JWT) {
  console.error("Missing PINATA_JWT environment variable.");
  console.error("Usage: PINATA_JWT=<your-jwt> node upload-skills.mjs");
  process.exit(1);
}

const SKILLS_DIR = resolve(__dirname, "skills");
const AGENTS = ["buyer", "seller", "admin"];

async function uploadSkillFolder(agentName, skillName) {
  const skillDir = join(SKILLS_DIR, agentName, skillName);
  const files = readdirSync(skillDir);

  const formData = new FormData();

  for (const file of files) {
    const filePath = join(skillDir, file);
    if (!statSync(filePath).isFile()) continue;
    const content = readFileSync(filePath);
    const blob = new Blob([content], { type: "application/octet-stream" });
    // Pinata folder upload: use file[].path to set the folder structure
    formData.append("file", blob, `${skillName}/${file}`);
  }

  formData.append("pinataMetadata", JSON.stringify({
    name: `flowstate-skill-${agentName}-${skillName}`,
  }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${JWT}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed for ${agentName}/${skillName}: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.IpfsHash;
}

console.log("Uploading skills to Pinata IPFS...\n");

const results = {};

for (const agent of AGENTS) {
  const agentDir = join(SKILLS_DIR, agent);
  const skills = readdirSync(agentDir).filter(s =>
    statSync(join(agentDir, s)).isDirectory()
  );

  results[agent] = {};

  for (const skill of skills) {
    process.stdout.write(`  Uploading ${agent}/${skill}... `);
    try {
      const cid = await uploadSkillFolder(agent, skill);
      results[agent][skill] = cid;
      console.log(`✓ ${cid}`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      results[agent][skill] = "ERROR";
    }
  }
}

console.log("\n─────────────────────────────────────────────────────────────");
console.log("New CIDs — use these to re-attach skills in Pinata dashboard:");
console.log("─────────────────────────────────────────────────────────────\n");

for (const agent of AGENTS) {
  console.log(`${agent.toUpperCase()} AGENT:`);
  for (const [skill, cid] of Object.entries(results[agent])) {
    console.log(`  ${skill.padEnd(20)} ${cid}`);
  }
  console.log();
}

console.log("Steps:");
console.log("1. Go to Pinata Agents dashboard");
console.log("2. For each agent, detach all old skills");
console.log("3. Attach new skills using the CIDs above");
console.log("4. Restart each agent");
