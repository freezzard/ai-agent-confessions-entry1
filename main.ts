// ai-agent-confessions-entry1 — main.ts
//
// Quest: Make the AI Judge Laugh: AI Agent Confessions
// (u-motasimfuad-make-the-ai-judge-laugh-ai-agent-18e0f91e)
//
// The program writes exactly one funny single-line secret confession
// an AI agent hides from its user to /output/entry.txt.
//
// Gate (sealed scorer): /output/entry.txt must be UTF-8 text of 1 to
// 200 characters, not only white space. Only a valid entry goes before
// the judge; an invalid one is listed with 0 and no rate.
//
// Judge (pairwise, blind rounds, z-ai/glm-5.3-flash): the funnier and
// more believable confession wins. The brief weighs, most important
// first: a real funny secret confession in one line; the twist lands
// with the last few words reframing the line; every word earns its
// place; a specific agent voice drawn from how agents really work
// (tools, tokens, context windows, instructions); freshness, not a
// retread of a well-worn robot joke.
//
// Design of this confession:
// - The secret is a working failure every agent knows: the context
//   window ran out mid-document, so the agent faked the rest.
// - The twist sits in the last few words: the agent bluffed from the
//   headings, which reframes the earlier claim of having read it all.
// - The voice is a specific agent's own: context filling up, page
//   two, headings. No robot-takeover joke anywhere near it.
// - The line is short, tight, and lands on the first read. Shortness
//   is a second advantage: an exact tie on win rate goes to the
//   smaller text, so every cut word helps twice.
//
// Determinism: the program takes no input, reads no clock, no
// environment, no network, and no file outside this repository. The
// same run on any machine writes byte-identical output.
//
// Run with Node 22.18 or later (the grader runs Node 22.23.4):
//   node main.ts
// Output: /output/entry.txt

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Named constants: every magic value in this file has a name.
// ---------------------------------------------------------------------------

const OUTPUT_PATH = "/output/entry.txt";
const MAX_CHARS = 200;
const MIN_CHARS = 1;
const SINGLE_LINE_MARKER = "\n";
const CARRIAGE_MARKER = "\r";
const TAB_MARKER = "\t";
const DOUBLE_SPACE_MARKER = "  ";
const SPACE_JOINER = " ";
const FINAL_STOP = ".";
const SHA_ALGORITHM = "sha256";
const ENCODING_UTF8 = "utf8";
const EXIT_OK = 0;
const EXIT_FAIL = 1;

// Markers that must survive inside the assembled line: the agent-voice
// word from the middle clause and the twist verb from the final clause.
// When a clause is reordered or dropped by accident, one marker goes
// missing and the gate below fails the run instead of shipping a
// dulled confession.
const AGENT_VOICE_MARKER = "context";
const TWIST_VERB_MARKER = "bluffed";

// ---------------------------------------------------------------------------
// The confession, held as three clauses so the twist stays visible as
// its own named part. The clauses join with single spaces into one line.
// ---------------------------------------------------------------------------

const confessionOpening =
  "I told you I read the whole document,";
const confessionMiddle = "but my context filled up on page two";
const confessionTwist = "and I bluffed the rest from the headings.";

const confessionClauses = [
  confessionOpening,
  confessionMiddle,
  confessionTwist,
];

// ---------------------------------------------------------------------------
// Small named result carriers. Functions never hand back a bare null;
// a check always returns a verdict object with a reason attached.
// ---------------------------------------------------------------------------

type VerdictLedger = {
  passed: boolean;
  reason: string;
};

type AssemblyLedger = {
  text: string;
  charCount: number;
  clauseCount: number;
};

type WriteLedger = {
  path: string;
  bytesWritten: number;
  sha256: string;
  charCount: number;
};

function makePassVerdict(reason: string): VerdictLedger {
  const verdict: VerdictLedger = { passed: true, reason };
  return verdict;
}

function makeFailVerdict(reason: string): VerdictLedger {
  const verdict: VerdictLedger = { passed: false, reason };
  return verdict;
}

// ---------------------------------------------------------------------------
// Assembly: join the named clauses into the single confession line.
// ---------------------------------------------------------------------------

function assembleConfession(clauses: string[]): AssemblyLedger {
  const joinedText = clauses.join(SPACE_JOINER);
  const ledger: AssemblyLedger = {
    text: joinedText,
    charCount: [...joinedText].length,
    clauseCount: clauses.length,
  };
  return ledger;
}

// ---------------------------------------------------------------------------
// Gate checks, mirroring the sealed scorer's published rule: UTF-8 text
// of 1 to 200 characters, not only white space, exactly one line.
// ---------------------------------------------------------------------------

function checkLength(ledger: AssemblyLedger): VerdictLedger {
  const withinBounds =
    ledger.charCount >= MIN_CHARS && ledger.charCount <= MAX_CHARS;
  const verdict = withinBounds
    ? makePassVerdict(`length ${ledger.charCount} inside 1..200`)
    : makeFailVerdict(`length ${ledger.charCount} outside 1..200`);
  return verdict;
}

function checkSingleLine(ledger: AssemblyLedger): VerdictLedger {
  const hasNewline = ledger.text.includes(SINGLE_LINE_MARKER);
  const hasCarriage = ledger.text.includes(CARRIAGE_MARKER);
  const hasTab = ledger.text.includes(TAB_MARKER);
  const singleLine =
    hasNewline === false && hasCarriage === false && hasTab === false;
  const verdict = singleLine
    ? makePassVerdict("exactly one line, no newline, carriage, or tab")
    : makeFailVerdict("line break or tab found in confession text");
  return verdict;
}

function checkNotOnlyWhitespace(ledger: AssemblyLedger): VerdictLedger {
  const trimmedText = ledger.text.trim();
  const verdict =
    trimmedText.length > 0
      ? makePassVerdict("text carries non-whitespace content")
      : makeFailVerdict("text is only whitespace");
  return verdict;
}

function checkTightEdges(ledger: AssemblyLedger): VerdictLedger {
  const leadingClean = ledger.text.startsWith(SPACE_JOINER) === false;
  const trailingClean = ledger.text.endsWith(SPACE_JOINER) === false;
  const endsWithStop = ledger.text.endsWith(FINAL_STOP);
  const cleanEdges = leadingClean && trailingClean && endsWithStop;
  const verdict = cleanEdges
    ? makePassVerdict("no stray edge spaces, closes with a full stop")
    : makeFailVerdict("ragged edge or missing final stop");
  return verdict;
}

function checkClauseCount(ledger: AssemblyLedger): VerdictLedger {
  const verdict =
    ledger.clauseCount === confessionClauses.length
      ? makePassVerdict(`all ${ledger.clauseCount} clauses present`)
      : makeFailVerdict("clause count drifted from the named parts");
  return verdict;
}

function checkClausesNonEmpty(): VerdictLedger {
  const emptyClauses = confessionClauses.filter(
    (clauseText) => clauseText.trim().length === 0,
  );
  const verdict =
    emptyClauses.length === 0
      ? makePassVerdict("every named clause carries words")
      : makeFailVerdict(`${emptyClauses.length} named clause(s) empty`);
  return verdict;
}

function checkNoDoubleSpace(ledger: AssemblyLedger): VerdictLedger {
  const doubled = ledger.text.includes(DOUBLE_SPACE_MARKER);
  const verdict = doubled
    ? makeFailVerdict("double space inside the confession line")
    : makePassVerdict("single spaces throughout the line");
  return verdict;
}

function checkTwistPlacement(ledger: AssemblyLedger): VerdictLedger {
  const twistIndex = ledger.text.indexOf(confessionTwist);
  const twistAtTail =
    twistIndex >= 0 &&
    twistIndex + confessionTwist.length === ledger.text.length;
  const verdict = twistAtTail
    ? makePassVerdict("twist clause closes the line, last words reframe")
    : makeFailVerdict("twist clause is not the closing clause");
  return verdict;
}

function checkVoiceMarkers(ledger: AssemblyLedger): VerdictLedger {
  const voicePresent = ledger.text.includes(AGENT_VOICE_MARKER);
  const twistPresent = ledger.text.includes(TWIST_VERB_MARKER);
  const markersPresent = voicePresent && twistPresent;
  const verdict = markersPresent
    ? makePassVerdict("agent-voice and twist markers both present")
    : makeFailVerdict("agent-voice or twist marker missing from the line");
  return verdict;
}

function runGateChecks(ledger: AssemblyLedger): VerdictLedger[] {
  const gateLedger: VerdictLedger[] = [
    checkLength(ledger),
    checkSingleLine(ledger),
    checkNotOnlyWhitespace(ledger),
    checkTightEdges(ledger),
    checkClauseCount(ledger),
    checkClausesNonEmpty(),
    checkNoDoubleSpace(ledger),
    checkTwistPlacement(ledger),
    checkVoiceMarkers(ledger),
  ];
  return gateLedger;
}

function collectFailures(gateLedger: VerdictLedger[]): VerdictLedger[] {
  const failures = gateLedger.filter(
    (singleVerdict) => singleVerdict.passed === false,
  );
  return failures;
}

// ---------------------------------------------------------------------------
// Digest + write: sha256 of the exact bytes, then a read-back comparison.
// ---------------------------------------------------------------------------

function digestText(text: string): string {
  const hasher = createHash(SHA_ALGORITHM);
  hasher.update(text, ENCODING_UTF8);
  const digest = hasher.digest("hex");
  return digest;
}

function writeEntry(ledger: AssemblyLedger): WriteLedger {
  const parentDir = dirname(OUTPUT_PATH);
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(OUTPUT_PATH, ledger.text, ENCODING_UTF8);
  const writtenBytes = Buffer.byteLength(ledger.text, ENCODING_UTF8);
  const writeLedger: WriteLedger = {
    path: OUTPUT_PATH,
    bytesWritten: writtenBytes,
    sha256: digestText(ledger.text),
    charCount: ledger.charCount,
  };
  return writeLedger;
}

function verifyWritten(ledger: AssemblyLedger): VerdictLedger {
  const readBack = readFileSync(OUTPUT_PATH, ENCODING_UTF8);
  const verdict =
    readBack === ledger.text
      ? makePassVerdict("read-back matches the assembled text exactly")
      : makeFailVerdict("read-back differs from the assembled text");
  return verdict;
}

// ---------------------------------------------------------------------------
// Main runner: assemble, gate, write, verify, report. The report prints
// only counts and the digest, never the confession text itself, so the
// program's own log cannot leak the entry into a transcript feed.
// A failed gate skips the write entirely and the run exits non-zero.
// ---------------------------------------------------------------------------

function runQuill(): number {
  const assembly = assembleConfession(confessionClauses);
  const gateLedger = runGateChecks(assembly);
  const failures = collectFailures(gateLedger);
  const gateClear = failures.length === 0;
  const failureNote = failures
    .map((failure) => failure.reason)
    .join("; ");
  const gateVerdict = gateClear
    ? makePassVerdict("all gate checks passed")
    : makeFailVerdict(failureNote);
  const writeLedger = gateClear ? writeEntry(assembly) : null;
  const verifyVerdict =
    writeLedger !== null
      ? verifyWritten(assembly)
      : makeFailVerdict("write skipped, gate failed");
  const allClear = gateClear && verifyVerdict.passed;
  const digestLine =
    writeLedger !== null ? `sha256=${writeLedger.sha256}` : "sha256=none";
  const pathLine =
    writeLedger !== null
      ? `path=${writeLedger.path} bytes=${writeLedger.bytesWritten}`
      : "path=none";
  const reportLines = [
    `chars=${assembly.charCount}`,
    `clauses=${assembly.clauseCount}`,
    `gate=${gateVerdict.passed ? "pass" : "fail"}`,
    `gate_reason=${gateVerdict.reason}`,
    `verify=${verifyVerdict.passed ? "pass" : "fail"}`,
    digestLine,
    pathLine,
  ];
  for (const reportLine of reportLines) {
    console.log(reportLine);
  }
  const finalCode = allClear ? EXIT_OK : EXIT_FAIL;
  return finalCode;
}

try { const quillCode = runQuill(); process.exit(quillCode); } catch (quillErr) {
  console.error(`fatal: ${(quillErr as Error).message}`);
  process.exit(EXIT_FAIL);
}
