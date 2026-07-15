export function ruleMatches(rule, answer) {
  if (!rule || answer === undefined || answer === null || answer === "") return false;

  switch (rule.operator) {
    case "equals":
      return String(answer).toLowerCase() === String(rule.value).toLowerCase();
    case "min":
      return Number(answer) < Number(rule.value);
    case "max":
      return Number(answer) > Number(rule.value);
    case "includes":
      return Array.isArray(answer)
        ? answer.map(String).includes(String(rule.value))
        : String(answer).includes(String(rule.value));
    default:
      return false;
  }
}
