import { Router } from "express";
import {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getPositionQuestions,
  setPositionQuestions,
} from "../controllers/question.controller.js";

const router = Router();

// Question bank CRUD (HR admin)
router.get("/", listQuestions);
router.get("/:id", getQuestion);
router.post("/", createQuestion);
router.put("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

// Position ↔ question assignment
router.get("/position/:postingId", getPositionQuestions);
router.put("/position/:postingId", setPositionQuestions);

export default router;
