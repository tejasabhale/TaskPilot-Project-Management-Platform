import { Project } from "../models/project.model.js";
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
    project,
  } = req.body;

  if (!title?.trim()) {
    throw new ApiError(400, "Task title is required.");
  }

  if (!workspace) {
    throw new ApiError(400, "Workspace is required.");
  }

  if (!project) {
    throw new ApiError(400, "Project is required.");
  }

  if (
    status &&
    !["todo", "inProgress", "review", "completed"].includes(status)
  ) {
    throw new ApiError(400, "Invalid task status.");
  }

  if (priority && !["low", "medium", "high"].includes(priority)) {
    throw new ApiError(400, "Invalid task priority.");
  }

  const workspaceExists = await Workspace.findById(workspace).populate(
    "members.user",
    "fullName email avatar",
  );

  if (!workspaceExists) {
    throw new ApiError(404, "Workspace not found.");
  }

  const currentMember = workspaceExists.members.find(
    (m) => m.user._id.toString() === req.user._id.toString(),
  );

  if (!currentMember) {
    throw new ApiError(403, "Access denied.");
  }

  if (!["owner", "admin"].includes(currentMember.role)) {
    throw new ApiError(403, "Only owners and admins can create tasks.");
  }

  const projectExists = await Project.findById(project);

  if (!projectExists) {
    throw new ApiError(404, "Project not found.");
  }

  if (projectExists.workspace.toString() !== workspaceExists._id.toString()) {
    throw new ApiError(
      400,
      "Project does not belong to the specified workspace.",
    );
  }

  if (assignedTo) {
    const assignedMember = workspaceExists.members.find(
      (m) => m.user._id.toString() === assignedTo.toString(),
    );

    if (!assignedMember) {
      throw new ApiError(
        400,
        "Assigned user is not a member of this workspace.",
      );
    }
  }

  if (dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    if (due < today) {
      throw new ApiError(400, "Due date cannot be in the past.");
    }
  }

  const task = await Task.create({
    title: title.trim(),
    description: description?.trim() || "",
    workspace: workspaceExists._id,
    project: projectExists._id,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
    status: status || "todo",
    priority: priority || "medium",
    dueDate: dueDate || null,
  });

  await task.populate([
    {
      path: "workspace",
      select: "name",
    },
    {
      path: "project",
      select: "name status",
    },
    {
      path: "assignedTo",
      select: "fullName email avatar",
    },
    {
      path: "createdBy",
      select: "fullName email avatar",
    },
  ]);
  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully."));
});

const getAllTasks = asyncHandler(async (req, res) => {
  const projectId = req.params;
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }
  const tasks = await Task.find({ project: projectId }).populate({
    path: "createdBy",
    select: "fullName email avatar",
  });
  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks fetched successfully."));
});

export { createTask };
