import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if ([name, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Name and Description are required.");
  }
  const exists = await Workspace.findOne({
    owner: req.user._id,
    name,
  });

  if (exists) {
    throw new ApiError(409, "Workspace already exists");
  }
  const workspace = await Workspace.create({
    name: name.trim(),
    description: description.trim(),
    owner: req.user._id,
    members: [
      {
        user: req.user._id,
        role: "owner",
      },
    ],
  });
  return res
    .status(201)
    .json(new ApiResponse(201, workspace, "Workspace created successfully."));
});

const getWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find({ "members.user": req.user._id })
    .populate("owner", "fullName  avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, workspaces, "Workspaces fetched successfully"));
});

const getWorkspaceById = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId)
    .populate("owner", "fullName email")
    .populate("members.user", "fullName email avatar");

  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }
  const isMember = workspace.members.some(
    (m) => m.user._id.toString() === req.user._id.toString(),
  );
  if (!isMember) {
    throw new ApiError(403, "Access denied");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, workspace, "Workspace fetched successfully."));
});

const updateWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { workspaceId } = req.params;
  if (name !== undefined && !name.trim()) {
  throw new ApiError(400, "Name is required");
}

if (description !== undefined && !description.trim()) {
  throw new ApiError(400, "Description is required");
}

  if (name) {
    const exists = await Workspace.findOne({
      owner: req.user._id,
      name,
      _id: { $ne: workspaceId },
    });

    if (exists) {
      throw new ApiError(409, "Workspace already exists");
    }
  }

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, "No workspace found");
  }

  const member = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member || !["admin", "owner"].includes(member.role)) {
    throw new ApiError(403, "Access denied");
  }

  if (name) workspace.name = name.trim();
  if (description) workspace.description = description.trim();
  await workspace.save();

  return res
    .status(200)
    .json(new ApiResponse(200, workspace, "Workspace updated successfully."));
});

const deleteWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "No workspace found");
  }
  const isOwner = workspace.owner.toString() === req.user._id.toString();
  if (!isOwner) {
    throw new ApiError(403, "Only owner can delete workspace!");
  }
  await workspace.deleteOne();
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Workspace deleted successfully!"));
});

export {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
};
