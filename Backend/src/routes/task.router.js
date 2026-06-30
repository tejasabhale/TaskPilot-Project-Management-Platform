import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { createTask } from "../controllers/task.controller.js";

const router = Router();

router.post("/", verifyJWT, createTask);

export default router;
