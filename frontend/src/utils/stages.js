export const STAGES = [
  "applied",
  "screening",
  "case_study_1",
  "interview",
  "case_study_2",
  "final_interview",
  "col_issued",
  "background_check",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

export const ACTIVE_STAGES = STAGES.filter((s) => !["hired", "rejected", "withdrawn"].includes(s));
export const TERMINAL_STAGES = ["hired", "rejected", "withdrawn"];

export const STAGE_LABELS = {
  applied: "Applied",
  screening: "Screening",
  case_study_1: "Case Study 1",
  interview: "Interview",
  case_study_2: "Case Study 2",
  final_interview: "Final Interview",
  col_issued: "COL Issued",
  background_check: "Background Check",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STAGE_STYLES = {
  applied: "bg-gray-100 text-gray-700",
  screening: "bg-amber-100 text-amber-800",
  case_study_1: "bg-orange-100 text-orange-800",
  interview: "bg-blue-100 text-blue-800",
  case_study_2: "bg-indigo-100 text-indigo-800",
  final_interview: "bg-purple-100 text-purple-800",
  col_issued: "bg-cyan-100 text-cyan-800",
  background_check: "bg-teal-100 text-teal-800",
  offer: "bg-violet-100 text-violet-800",
  hired: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-zinc-100 text-zinc-600",
};

export function StageBadge({ stage }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${STAGE_STYLES[stage] || "bg-gray-100"}`}>
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}
