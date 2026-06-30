import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["todo", "inProgress", "review", "completed"],
      default: "todo",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    dueDate: {
      type: Date,
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    attachments: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
        fileName: String,
        fileType: String,
        fileSize: Number,
      },
    ],
  },
  {
    timestamps: true,
  },
);
taskSchema.index({ project: 1 });
taskSchema.index({ assignedTo: 1 });

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, dueDate: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ workspace: 1, assignedTo: 1 });
taskSchema.index({ workspace: 1, project: 1 });

export const Task = mongoose.model("Task", taskSchema);
