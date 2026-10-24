// Helps a person verify data/programs before setting last_verified.
//   npm run check:programs
// For each program: fetches its link, reports the HTTP status, and checks
// whether each phone number, email, and dollar amount in the record appears
// on the page. It does NOT set last_verified. A person still reads the page.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "programs");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const FACT_PATTERNS = [
  /\$\s?\d[\d,]*(\.\d+)?/g,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
  /\b\d{3}[-.\s][A-Z]{4}\b/g,
  /[\w.+-]+@[\w-]+\.[\w.]+/g,
];

const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ");

function pageText(html) {
  return normalize(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#8209;|&#x2011;/g, "-"),
  );
}

function factsIn(program) {
  const text = [program.description, ...Object.values(program.details ?? {})].join(" ");
  const found = new Set();
  for (const p of FACT_PATTERNS) for (const m of text.matchAll(p)) found.add(m[0].replace(/[.,;:)]+$/, ""));
  return [...found];
}

const files = (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort();
let problems = 0;

for (const file of files) {
  const { programs } = JSON.parse(await readFile(path.join(DIR, file), "utf8"));
  for (const p of programs) {
    let status = "ERR";
    let text = "";
    try {
      const res = await fetch(p.link, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
      status = String(res.status);
      if (res.ok) text = pageText(await res.text());
    } catch (err) {
      status = `ERR ${err.message}`;
    }
    const facts = factsIn(p);
    const missing = text ? facts.filter((f) => !text.includes(normalize(f))) : facts;
    const ok = status === "200" && missing.length === 0;
    if (!ok) problems++;
    console.log(`${ok ? "✓" : "!"} ${p.id}`);
    console.log(`    link ${status}  ${p.link}`);
    console.log(`    last_verified: ${p.last_verified ?? "null (hidden from users)"}`);
    if (facts.length) {
      console.log(`    facts found on page: ${facts.filter((f) => !missing.includes(f)).join(", ") || "none"}`);
      if (missing.length) console.log(`    NOT found on page (check by hand): ${missing.join(", ")}`);
    }
  }
}

console.log(
  problems
    ? `\n${problems} program(s) need a closer look. Some sites block automated reading (e.g. mass.gov), so open those links in a browser.`
    : "\nAll links load and all facts appear on their pages. Still read each page before setting last_verified.",
);
