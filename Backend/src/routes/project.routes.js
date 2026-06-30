import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import {
  deleteProject,
  getProjectById,
  getProjectStats,
  updateProject,
} from "../controllers/project.controller.js";

const router = Router();

router.get(
  "/:projectId",
  verifyJWT,
  validateObjectId("projectId"),
  getProjectById,
);

router.patch(
  "/:projectId",
  verifyJWT,
  validateObjectId("projectId"),
  updateProject,
);

router.delete(
  "/:projectId",
  verifyJWT,
  validateObjectId("projectId"),
  deleteProject,
);

router.get(
  "/:projectId/getStats",
  verifyJWT,
  validateObjectId("projectId"),
  getProjectStats,
);

export default router;
