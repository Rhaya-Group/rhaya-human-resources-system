// backend/src/routes/applicantAuth.routes.js
// Public candidate auth for the recruitment site.
import express from "express";
import { body } from "express-validator";
import * as applicantAuthController from "../controllers/applicantAuth.controller.js";
import { applicantAuthenticate } from "../middleware/applicantAuth.js";

const router = express.Router();

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("name").notEmpty().withMessage("Name is required").trim(),
    body("phone").optional({ nullable: true }).trim(),
  ],
  applicantAuthController.register,
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  applicantAuthController.login,
);

router.get("/me", applicantAuthenticate, applicantAuthController.me);

export default router;
