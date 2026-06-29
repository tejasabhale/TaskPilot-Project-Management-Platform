import { Task } from "../models/task.model.js";
import { User } from "../models/user.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim() || !description?.trim()) {
    throw new ApiError(400, "Name and Description are required.");
  }
  const exists = await Workspace.findOne({
    owner: req.user._id,
    name: name.trim(),
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
  const workspaces = await Workspace.find({
    $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
  })
    .populate("owner", "fullName email avatar")
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
    (m) => m.user?._id.toString() === req.user._id.toString(),
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
      name: name.trim(),
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

const getWorkspaceMembers = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId).populate(
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
    .json(
      new ApiResponse(200, workspace.members, "Members fetched successfully."),
    );
});

const addWorkspaceMembers = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  if (!email?.trim()) {
    throw new ApiError(400, "Email is required");
  }

  const memberRole = role || "member";
  if (!["member", "admin"].includes(memberRole)) {
    throw new ApiError(400, "Invalid role");
  }
  const normalizedEmail = email.trim().toLowerCase();

  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }

  const member = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!member || !["admin", "owner"].includes(member.role)) {
    throw new ApiError(403, "Access denied.");
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (!user.isVerified) {
    throw new ApiError(
      403,
      "User must verify their email before being added to a workspace.",
    );
  }

  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, "You are already a member");
  }

  const alreadyMember = workspace.members.some(
    (m) => m.user.toString() === user._id.toString(),
  );

  if (alreadyMember) {
    throw new ApiError(409, "User already a member");
  }

  workspace.members.push({
    user: user._id,
    role: memberRole,
  });
  await workspace.save();

  await workspace.populate("members.user", "fullName email avatar");

  return res
    .status(201)
    .json(new ApiResponse(201, workspace, "Member added successfully."));
});

const removeWorkspaceMember = asyncHandler(async (req, res) => {
  const { workspaceId, memberId } = req.params;
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, "No workspace found.");
  }

  const currentMember = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!currentMember) {
    throw new ApiError(403, "Access denied.");
  }

  const targetMember = workspace.members.find(
    (m) => m.user.toString() === memberId,
  );

  if (!targetMember) {
    throw new ApiError(404, "Member not found.");
  }

  if (req.user._id.toString() === memberId) {
    throw new ApiError(400, "Use the leave workspace endpoint instead.");
  }

  const permissions = {
    owner: ["admin", "member"],
    admin: ["member"],
    member: [],
  };

  if (!permissions[currentMember.role].includes(targetMember.role)) {
    throw new ApiError(
      403,
      `${currentMember.role} cannot remove ${targetMember.role}`,
    );
  }

  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    {
      $pull: {
        members: {
          user: memberId,
        },
      },
    },
    { new: true },
  ).populate("members.user", "fullName email avatar");

  if (!updatedWorkspace) {
    throw new ApiError(404, "Workspace not found.");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedWorkspace, "Member removed successfully."),
    );
});

const leaveWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }
  const member = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );
  if (!member) {
    throw new ApiError(403, "Not workspace member!");
  }
  if (member.role === "owner") {
    throw new ApiError(403, "Owner cannot leave workspace.");
  }
  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    {
      $pull: {
        members: {
          user: member.user,
        },
      },
    },
    { new: true },
  ).populate("members.user", "fullName email avatar");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedWorkspace, "Left workspace successfully."),
    );
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { workspaceId, memberId } = req.params;
  const { role } = req.body;

  if (!["admin", "member"].includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, "No workspace found.");
  }

  const currentMember = workspace.members.find(
    (m) => m.user.toString() === req.user._id.toString(),
  );

  if (!currentMember) {
    throw new ApiError(403, "Access denied.");
  }

  const targetMember = workspace.members.find(
    (m) => m.user.toString() === memberId,
  );

  if (!targetMember) {
    throw new ApiError(404, "Member not found.");
  }

  const permissions = {
    owner: ["admin", "member"],
    admin: [],
    member: [],
  };

  if (req.user._id.toString() === memberId) {
    throw new ApiError(400, "You cannot change your own role.");
  }

  if (targetMember.role === "owner") {
    throw new ApiError(403, "Owner cannot be changed.");
  }

  if (targetMember.role === role) {
    throw new ApiError(400, "Member already has this role.");
  }

  if (!permissions[currentMember.role].includes(targetMember.role)) {
    throw new ApiError(
      403,
      `${currentMember.role} cannot change ${targetMember.role}`,
    );
  }

  targetMember.role = role;
  await workspace.save();
  await workspace.populate("members.user", "fullName email avatar");

  return res
    .status(200)
    .json(new ApiResponse(200, workspace, "Member role updated successfully!"));
});

const getWorkspaceStats = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }

  const isMember = workspace.members.some(
    (member) => member.user.toString() === req.user._id.toString(),
  );

  if (!isMember) {
    throw new ApiError(403, "Access denied");
  }

  const totalMembers = workspace.members.length;

  const admins = workspace.members.filter((m) => m.role === "admin").length;

  const members = workspace.members.filter((m) => m.role === "member").length;

  const tasks = await Task.countDocuments({
    workspace: workspaceId,
  });

  const completedTasks = await Task.countDocuments({
    workspace: workspaceId,
    status: "Completed",
  });

  return res.status(200).json(
    new ApiResponse(200, {
      totalMembers,
      members,
      admins,
      members,
      tasks,
      completedTasks,
    }),
  );
});

export {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMembers,
  removeWorkspaceMember,
  leaveWorkspace,
  updateMemberRole,
  getWorkspaceStats,
};
