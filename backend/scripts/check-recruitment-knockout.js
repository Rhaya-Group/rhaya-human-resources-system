import assert from "node:assert/strict";
import { ruleMatches } from "../src/utils/recruitmentKnockout.js";

assert.equal(ruleMatches({ operator: "equals", value: "yes" }, "YES"), true);
assert.equal(ruleMatches({ operator: "min", value: 3 }, 2), true);
assert.equal(ruleMatches({ operator: "min", value: 3 }, 3), false);
assert.equal(ruleMatches({ operator: "max", value: 5 }, 6), true);
assert.equal(ruleMatches({ operator: "includes", value: "react" }, ["js", "react"]), true);
assert.equal(ruleMatches({ operator: "includes", value: "remote" }, "remote work"), true);
assert.equal(ruleMatches({ operator: "equals", value: "yes" }, ""), false);

console.log("recruitment knockout check passed");
