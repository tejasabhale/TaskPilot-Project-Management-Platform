import { Router } from "express";
import { addWorkspaceMembers, createWorkspace, deleteWorkspace, getWorkspaceById, getWorkspaceMembers, getWorkspaces, removeWorkspaceMember, updateWorkspace } from "../controllers/workspace.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";

const router = Router();

router.post("/", verifyJWT, createWorkspace);
router.post("/:workspaceId/add-member", verifyJWT, validateObjectId("workspaceId"), addWorkspaceMembers);
router.get("/", verifyJWT, getWorkspaces);
router.get("/:workspaceId", verifyJWT, validateObjectId("workspaceId"), getWorkspaceById);
router.get("/:workspaceId/members", verifyJWT, validateObjectId("workspaceId"), getWorkspaceMembers)
router.patch("/:workspaceId", verifyJWT, validateObjectId("workspaceId"), updateWorkspace);
router.delete("/:workspaceId", verifyJWT, validateObjectId("workspaceId"), deleteWorkspace);
router.delete("/:workspaceId/remove-member/:memberId", verifyJWT, validateObjectId("workspaceId", "memberId"), removeWorkspaceMember);

export default router;