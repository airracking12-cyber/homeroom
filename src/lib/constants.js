// Fixed lists and small rules the whole app agrees on: subjects and their colours, task types, priorities, statuses,
// and which tasks ask for a photo. Moved out of App.jsx unchanged.

export const SUBJ = {
  Mathematics: "#5A7FA8",
  "Values Education": "#B38A2E",
  "Araling Panlipunan": "#8A877A",
  Filipino: "#5F8B6D",
};

export const PAL = ["#C4684A", "#8B6B86", "#4F8A8B", "#9A7B4F", "#6E7FA3"];
// Subjects your class adds (with the colour they picked) are copied in here, so subjColor() works everywhere.
export const SUBJ_REG = { ...SUBJ };
export const subjColor = (s) =>
  SUBJ_REG[s] || PAL[[...(s || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
export const SWATCHES = ["#5A7FA8", "#5F8B6D", "#B38A2E", "#C4623F", "#8B6B86", "#4F8A8B", "#B5586B", "#7A8F3E", "#6E7FA3", "#8A877A", "#3F6E8C", "#9A7B4F"];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const TYPES = ["Homework", "Mini Task", "Quiz", "Study", "Project", "Exam"];
export const REVIEW_TYPES = ["Quiz", "Study", "Exam"];
export const QUARTERS = [1, 2, 3, 4];
export const MAX_PROOF = 6;
// Quizzes, study sessions and exams are things you review for, so they never ask for a photo.
export const needsProofType = (t) => !REVIEW_TYPES.includes(t.type);
export const wantsProof = (t) => needsProofType(t) && t.proof !== false;
export const PRIORITIES = ["High", "Medium", "Low"];
export const STATUSES = [["todo", "Not started"], ["progress", "In progress"], ["done", "Done"]];
export const DEFAULT_SUBJECTS = Object.keys(SUBJ);

export const statusLabel = (s) => (STATUSES.find((x) => x[0] === (s || "todo")) || STATUSES[0])[1];
