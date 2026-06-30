import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3
    },
    description: {
      type: String,
      default: "",
      minlength: 5,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["owner", "member", "admin"],
          default: "member",
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

workspaceSchema.index({ "members.user": 1 });

export const Workspace = mongoose.model("Workspace", workspaceSchema);
