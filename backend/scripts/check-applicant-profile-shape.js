import assert from "node:assert/strict";
import { validateParsedCvShape } from "../src/controllers/applicantProfile.controller.js";

const valid = {
  summary: "",
  work_history: [{ company: "", title: "", industry: "", start: "2026-07", end: null, current: true, description: "" }],
  education: [{ institution: "", degree: "", field_of_study: "", start: "2026-07", end: "2026-07", graduated: true }],
  skills: [{ name: "", level: "intermediate" }],
  languages: [{ language: "", proficiency: "professional" }],
  links: { linkedin: null, portfolio: null, github: null },
};

assert.equal(validateParsedCvShape(valid), null);
assert.match(validateParsedCvShape({ ...valid, surprise: true }), /unknown keys/);
assert.match(validateParsedCvShape({ ...valid, links: [] }), /links must be an object/);
assert.match(validateParsedCvShape({ ...valid, work_history: [{ ...valid.work_history[0], extra: true }] }), /unknown keys/);

console.log("applicant profile shape check passed");
