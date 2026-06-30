import { Project } from "../models/project.model.js";
import { Task } from "../models/task.model.js";
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

  await project.populate([
    { path: "workspace", select: "name" },
    { path: "createdBy", select: "fullName email avatar" },
  ]);

  return res
    .status(201)
    .json(new ApiResponse(201, project, "Project created successfully."));
});

const getAllProjects = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }
  const member = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member) {
    throw new ApiError(403, "Access denied.");
  }

  const projects = await Project.find({
    workspace: workspaceId,
  })
    .populate("createdBy", "fullName email avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects fetched successfully."));
});

const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId).populate([
    { path: "workspace", select: "members" },
    { path: "createdBy", select: "fullName email avatar" },
  ]);
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }
  const member = project.workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );
  if (!member) {
    throw new ApiError(403, "Access denied.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project fetched successfully."));
});

const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { name, description, status, startDate, endDate } = req.body;

  const project = await Project.findById(projectId).populate([
    { path: "workspace", select: "members" },
    { path: "createdBy", select: "fullName email avatar" },
  ]);

  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  const member = project.workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member) {
    throw new ApiError(403, "Access denied.");
  }

  if (!["owner", "admin"].includes(member.role)) {
    throw new ApiError(403, "Only owner and admin can update projects.");
  }

  if (name) {
    const exists = await Project.findOne({
      name: name.trim(),
      workspace: project.workspace._id,
      _id: { $ne: projectId },
    });
    if (exists) {
      throw new ApiError(409, "Project with this name already exists.");
    }
  }

  const newStartDate = startDate ?? project.startDate;
  const newEndDate = endDate ?? project.endDate;

  if (
    newStartDate &&
    newEndDate &&
    new Date(newStartDate) > new Date(newEndDate)
  ) {
    throw new ApiError(400, "Start date cannot be after end date.");
  }

  if (name !== undefined) {
    if (!name.trim()) {
      throw new ApiError(400, "Project name cannot be empty.");
    }
    project.name = name.trim();
  }

  if (description !== undefined) {
    project.description = description?.trim() || "";
  }

  if (status !== undefined) {
    project.status = status;
  }

  if (startDate !== undefined) {
    project.startDate = startDate;
  }

  if (endDate !== undefined) {
    project.endDate = endDate;
  }

  await project.save();

  const updatedProject = await Project.findById(project._id).populate([
    { path: "workspace", select: "name" },
    { path: "createdBy", select: "fullName email avatar" },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedProject, "Project updated successfully."),
    );
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId).populate(
    "workspace",
    "members",
  );
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  const member = project.workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member) {
    throw new ApiError(403, "Access denied.");
  }

  if (!["owner", "admin"].includes(member.role)) {
    throw new ApiError(403, "Only owner and admins can delete project.");
  }

  await Task.deleteMany({ project: projectId });
  await project.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully."));
});

const getProjectStats = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId).populate(
    "workspace",
    "members",
  );
  if (!project) {
    throw new ApiError(404, "Project not found.");
  }

  const member = project.workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member) {
    throw new ApiError(403, "Access denied.");
  }

  const [totalTasks, todo, inProgress, inReview, completed, overdue] =
    await Promise.all([
      Task.countDocuments({ project: projectId }),
      Task.countDocuments({ project: projectId, status: "todo" }),
      Task.countDocuments({ project: projectId, status: "inProgress" }),
      Task.countDocuments({ project: projectId, status: "inReview" }),
      Task.countDocuments({ project: projectId, status: "completed" }),
      Task.countDocuments({
        project: projectId,
        dueDate: { $lt: new Date() },
        status: { $ne: "Completed" },
      }),
    ]);

  const completionPercentage =
    totalTasks === 0 ? 0 : Number(((completed / totalTasks) * 100).toFixed(2));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalTasks,
        todo,
        inProgress,
        inReview,
        completed,
        overdue,
        completionPercentage,
      },
      "",
    ),
  );
});

export {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectStats
};
