import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

export const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ${paramName}`);
    }
    next();
  };
};
