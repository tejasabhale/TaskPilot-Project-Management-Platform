import { Otp } from "../models/otp.model.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to generate tokens",
    );
  }
};

const register = asyncHandler(async (req, res) => {
  const { userName, fullName, mobileNo, password, email } = req.body;
  if (
    [userName, fullName, email, password].some(
      (field) => field?.trim() === "",
    ) ||
    !mobileNo
  ) {
    throw new ApiError(400, "All fields are required!");
  }
  const normalizedUserName = userName.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  const existedUser = await User.findOne({
    $or: [
      { userName: normalizedUserName },
      { email: normalizedEmail },
      { mobileNo },
    ],
  });
  if (existedUser) {
    throw new ApiError(
      409,
      "User with same email, username, or mobile number already exists.",
    );
  }
  const user = await User.create({
    userName: normalizedUserName,
    fullName,
    password,
    email: normalizedEmail,
    mobileNo,
  });
  if (!user) {
    throw new ApiError(500, "Error while registering user");
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  if (process.env.NODE_ENV !== "production") {
    console.log(`OTP for ${normalizedEmail} is ${otp}`);
  }
  await Otp.deleteMany({
    email: normalizedEmail,
    action: "registration",
  });

  await Otp.create({
    email: normalizedEmail,
    otp: hashedOtp,
    action: "registration",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        email,
      },
      "User registered successfully",
    ),
  );
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required!");
  }

  const normalizedEmail = email.toLowerCase();

  if (!/^\d{6}$/.test(otp.toString())) {
    throw new ApiError(400, "Invalid OTP format");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  if (existingUser.isVerified) {
    throw new ApiError(400, "User is already verified");
  }

  const otpRecord = await Otp.findOne({
    email: normalizedEmail,
    action: "registration",
  }).sort({
    createdAt: -1,
  });

  if (!otpRecord) {
    throw new ApiError(400, "No OTP found!");
  }
  if (otpRecord.expiresAt < new Date()) {
    throw new ApiError(400, "OTP has expired");
  }

  const isOtpValid = await bcrypt.compare(otp.toString(), otpRecord.otp);

  if (!isOtpValid) {
    throw new ApiError(400, "Invalid OTP");
  }

  const user = await User.findOneAndUpdate(
    {
      email: normalizedEmail,
    },
    {
      $set: { isVerified: true },
    },
    {
      new: true,
    },
  );

  if (!user) {
    throw new ApiError(404, "User not found!");
  }

  await Otp.deleteMany({
    email: normalizedEmail,
    action: "registration",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User verified successfully!"));
});

const login = asyncHandler(async (req, res) => {
  const { userName, email, password } = req.body;

  if (!(userName || email)) {
    throw new ApiError(400, "Username or Email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const normalizedUserName = userName?.toLowerCase();
  const normalizedEmail = email?.toLowerCase();

  const user = await User.findOne({
    $or: [{ userName: normalizedUserName }, { email: normalizedEmail }],
  }).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your account first");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials!");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );
  const loggedInUser = await User.findById(user._id);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          verified: true,
        },
        "User logged in successfully",
      ),
    );
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: {
      refreshToken: 1,
    },
  });
  return res
    .status(200)
    .clearCookie("accessToken", clearCookieOptions)
    .clearCookie("refreshToken", clearCookieOptions)
    .json(new ApiResponse(200, {}, "User logged out."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
  const user = await User.findById(decoded._id).select("+refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Invalid refresh token");
  }
  if (!user.isVerified) {
    throw new ApiError(403, "User is not verified");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, {}, "Access token refreshed successfully"));
});

export { register, verifyOtp, login, logout, refreshAccessToken };
