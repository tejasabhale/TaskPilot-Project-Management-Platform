import { Project } from "../models/project.model.js";
import { Task } from "../models/task.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status, priority, dueDate } =
    req.body;

  const { projectId } = req.params;

  if (!title?.trim()) {
    throw new ApiError(400, "Task title is required.");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  const workspace = await Workspace.findById(project.workspace).populate(
    "members.user",
    "fullName email avatar",
  );

  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
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

  const currentMember = workspace.members.find(
    (m) => m.user._id.toString() === req.user._id.toString(),
  );

  if (!currentMember) {
    throw new ApiError(403, "Access denied.");
  }

  if (!["owner", "admin"].includes(currentMember.role)) {
    throw new ApiError(403, "Only owners and admins can create tasks.");
  }

  if (assignedTo) {
    const assignedMember = workspace.members.find(
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
    workspace: workspace._id,
    project: project._id,
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
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  const workspace = await Workspace.findById(project.workspace);

  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }

  const member = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member) {
    throw new ApiError(403, "Access denied.");
  }

  const tasks = await Task.find({ project: projectId })
    .populate("project", "name status")
    .populate("workspace", "name")
    .populate("assignedTo", "fullName email avatar")
    .populate("createdBy", "fullName email avatar")
    .sort({ createdAt: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks fetched successfully."));
});

const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findById(taskId)
    .populate("workspace", "name")
    .populate("project", "name status")
    .populate("assignedTo", "fullName email avatar")
    .populate("createdBy", "fullName email avatar");
  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  const workspace = await Workspace.findById(task.workspace).populate(
    "members.user",
    "fullName email avatar",
  );

  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }

  const member = workspace.members.find(
    (m) => m.user._id.toString() === req.user._id.toString(),
  );

  if (!member) {
    throw new ApiError(403, "Access denied.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task fetched successfully."));
});

const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, assignedTo, priority, dueDate } =
    req.body;

  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  const workspace = await Workspace.findById(task.workspace);

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
    throw new ApiError(403, "Only owner and admins can update tasks.");
  }

  if (title !== undefined) {
    if (!title.trim()) {
      throw new ApiError(400, "Title cannot be empty.");
    }
    const existingTask = await Task.findOne({
      title: title.trim(),
      project: task.project,
      _id: { $ne: taskId },
    });
    if (existingTask) {
      throw new ApiError(
        409,
        "Task with this title already exists in this project",
      );
    }
    task.title = title.trim();
  }

  if (assignedTo !== undefined) {
    if (assignedTo === null || assignedTo === "") {
      task.assignedTo = null;
    } else {
      const assignedMember = workspace.members.find(
        (member) => member.user.toString() === assignedTo.toString(),
      );

      if (!assignedMember) {
        throw new ApiError(
          404,
          "Assigned user is not a member of this workspace.",
        );
      }

      task.assignedTo = assignedTo;
    }
  }

  if (dueDate !== undefined) {
    if (dueDate) {
      const parsedDate = new Date(dueDate);

      if (isNaN(parsedDate.getTime())) {
        throw new ApiError(400, "Invalid date.");
      }

      if (parsedDate < new Date()) {
        throw new ApiError(400, "Due date cannot be in the past.");
      }

      task.dueDate = parsedDate;
    } else {
      task.dueDate = null;
    }
  }

  if (description !== undefined) {
    task.description = description?.trim() || "";
  }

  const allowedStatus = ["todo", "inProgress", "review", "completed"];

  if (status != undefined && !allowedStatus.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  if (status !== undefined) {
    task.status = status;
  }

  const allowedPriority = ["low", "medium", "high"];

  if (priority !== undefined && !allowedPriority.includes(priority)) {
    throw new ApiError(400, "Invalid priority.");
  }

  if (priority !== undefined) {
    task.priority = priority;
  }

  await task.save();

  const updatedTask = await Task.findById(taskId)
    .populate("project", "name")
    .populate("workspace", "name")
    .populate("createdBy", "fullName userName email avatar")
    .populate("assignedTo", "fullName userName email avatar")
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTask, "Task updated successfully."));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(404, "Task not found.");
  }

  const workspace = await Workspace.findById(task.workspace);

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
    throw new ApiError(403, "Only owner and admins can delete tasks.");
  }

  await task.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Task deleted successfully."));
});

const myTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({
    assignedTo: req.user._id,
  })
    .populate("workspace", "name")
    .populate("project", "name status")
    .populate("createdBy", "fullName email avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks fetched successfully."));
});

export { createTask, getAllTasks, getTaskById, updateTask, deleteTask, myTasks };
