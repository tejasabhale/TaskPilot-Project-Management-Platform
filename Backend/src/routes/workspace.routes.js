import { Router } from "express";
import {
  addWorkspaceMembers,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  getWorkspaceMembers,
  getWorkspaces,
  getWorkspaceStats,
  leaveWorkspace,
  removeWorkspaceMember,
  updateMemberRole,
  updateWorkspace,
} from "../controllers/workspace.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";

const router = Router();

router.post("/", verifyJWT, createWorkspace);

router.post(
  "/:workspaceId/add-member",
  verifyJWT,
  validateObjectId("workspaceId"),
  addWorkspaceMembers,
);

router.post(
  "/:workspaceId/leave-workspace",
  verifyJWT,
  validateObjectId("workspaceId"),
  leaveWorkspace,
);

router.post(
  "/:workspaceId/update-member-role/:memberId",
  verifyJWT,
  validateObjectId("workspaceId", "memberId"),
  updateMemberRole,
);

router.get("/", verifyJWT, getWorkspaces);

router.get(
  "/:workspaceId",
  verifyJWT,
  validateObjectId("workspaceId"),
  getWorkspaceById,
);

router.get(
  "/:workspaceId/members",
  verifyJWT,
  validateObjectId("workspaceId"),
  getWorkspaceMembers,
);

router.get(
  "/:workspaceId/stats",
  verifyJWT,
  validateObjectId("workspaceId"),
  getWorkspaceStats,
);

router.patch(
  "/:workspaceId",
  verifyJWT,
  validateObjectId("workspaceId"),
  updateWorkspace,
);

router.delete(
  "/:workspaceId",
  verifyJWT,
  validateObjectId("workspaceId"),
  deleteWorkspace,
);

router.delete(
  "/:workspaceId/remove-member/:memberId",
  verifyJWT,
  validateObjectId("workspaceId", "memberId"),
  removeWorkspaceMember,
);

export default router;
