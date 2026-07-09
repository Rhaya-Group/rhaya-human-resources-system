import { Router } from "express";
import { listOverseers, addOverseer, removeOverseer } from "../controllers/positionOverseer.controller.js";

const router = Router();

router.get("/:postingId/overseers", listOverseers);
router.post("/:postingId/overseers", addOverseer);
router.delete("/:postingId/overseers/:userId", removeOverseer);

export default router;
