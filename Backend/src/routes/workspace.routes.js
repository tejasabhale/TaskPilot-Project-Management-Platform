import { Router } from "express";
import { createWorkspace, deleteWorkspace, getWorkspaceById, getWorkspaces, updateWorkspace } from "../controllers/workspace.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createWorkspace);
router.get("/", verifyJWT, getWorkspaces);
router.get("/:workspaceId", verifyJWT, getWorkspaceById);
router.patch("/:workspaceId", verifyJWT, updateWorkspace);
router.delete("/:workspaceId", verifyJWT, deleteWorkspace);

export default router;