import { Project } from "../models/project.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createProject = asyncHandler(async (req, res) => {
  const { name, description, status, startDate, endDate } = req.body;
  const { workspaceId } = req.params;

  if (!name?.trim()) {
    throw new ApiError(400, "Name is required");
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }

  const currentMember = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );
  if (!currentMember) {
    throw new ApiError(403, "Access denied.");
  }
  if (!["owner", "admin"].includes(currentMember.role)) {
    throw new ApiError(403, "Only owner and admin can create project.");
  }

  const existedProject = await Project.findOne({
    workspace: workspaceId,
    name: name.trim(),
  });

  if (existedProject) {
    throw new ApiError(
      409,
      "A project with this name is already exists in this workspace.",
    );
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new ApiError(400, "Start date cannot be after end date");
  }

  const project = await Project.create({
    name: name.trim(),
    description: description?.trim() || "",
    workspace: workspaceId,
    createdBy: req.user._id,
    status,
    startDate,
    endDate,
  });

  await project
    .populate("workspace", "name")
    .populate("createdBy", "fullName email avatar");

  return res
    .status(201)
    .json(new ApiResponse(201, project, "Project created successfully."));
});

export { createProject };
