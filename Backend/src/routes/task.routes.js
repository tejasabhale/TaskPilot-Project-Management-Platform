import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import {
  createTask,
  deleteTask,
  getTaskById,
  myTasks,
  updateTask,
} from "../controllers/task.controller.js";

const router = Router();

router.get("/me", verifyJWT, myTasks);
router.get("/:taskId", verifyJWT, validateObjectId("taskId"), getTaskById);
router.patch("/:taskId", verifyJWT, validateObjectId("taskId"), updateTask);
router.delete("/:taskId", verifyJWT, validateObjectId("taskId"), deleteTask);

export default router;
