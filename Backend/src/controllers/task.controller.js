import { Task } from "../models/task.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    workspace,
    assignedTo,
    status,
    priority,
    dueDate,
  } = req.body;

  if (!title.trim()) {
    throw new ApiError(400, "Title is required.");
  }

  if (!workspace) {
    throw new ApiError(400, "Workspace is required.");
  }

  const workspaceExists = await Workspace.findById(workspace);

  if (!workspaceExists) {
    throw new ApiError(404, "Workspace not found.");
  }

  const currentMember = await workspaceExists.members.find(
    (m) => m.user.toString() === req.user._id,
  );

  if (!currentMember) {
    throw new ApiError(403, "Access denied");
  }

  if (!["owner", "admin"].includes(currentMember.role)) {
    throw new ApiError(403, "Only workspace owner or admin can create tasks.");
  }

  if (assignedTo) {
    const assignedMember = await workspaceExists.members.find(
      (m) => m.user.toString() === assignedTo,
    );
    if (!assignedTo) {
      throw new ApiError(404, "Assigned user is not member of worspace");
    }
  }

  const task = await Task.create({
    title: title.trim(),
    description: description.trim() || "",
    workspace,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
    status: status || "Todo",
    priority: priority || "Medium",
    dueDate: dueDate || null,
    attachments: [],
  })
    .populate("workspace", "name")
    .populate("assignedTo", "userName email avatar")
    .populate("createdBy", "userName email avatar");

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully."));
});
