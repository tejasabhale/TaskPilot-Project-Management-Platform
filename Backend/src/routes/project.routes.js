import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { createProject } from "../controllers/project.controller.js";

const router = Router();

router.post(
  "/workspace/:workspaceId",
  verifyJWT,
  validateObjectId("workspaceID"),
  createProject,
);

export default router;  
