require("dotenv").config();
import userModel, { IUser } from "../models/user.model";
import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { access } from "fs";
import exp from "constants";
import { getUserById } from "../services/user.service";

// Register a user

interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registerUser = CatchAsyncError(
  async (req: Request, res: Response, next: any) => {
    try {
      const { name, email, password, avatar } = req.body;

      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email is already exist", 400));
      }

      const user: IRegistrationBody = {
        name,
        email,
        password,
      };

      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;

      const data = {
        user: { name: user.name },
        activationCode: activationCode,
      };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );
      try {
        await sendMail({
          email: user.email,
          subject: "Account Activation",
          template: "activation-mail",
          data,
        });

        res.status(201).json({
          success: true,
          message: "Account activation email sent",
          activationToken: activationToken.token,
        });
      } catch (err: any) {
        return next(new ErrorHandler(err.message, 400));
      }
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (
  user: IRegistrationBody
): IActivationToken => {
  const activationCode: string = Math.floor(
    1000 + Math.random() * 9000
  ).toString();
  const activationCodeCreatedAt: number = Date.now();
  const token = jwt.sign(
    { user, activationCode, activationCodeCreatedAt },
    process.env.JWT_SECRET as Secret,
    { expiresIn: "10m" }
  );
  return { token, activationCode };
};

// Activate user account

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: any) => {
    try {
      const { token, activationCode } = req.body;
      if (!token) {
        return next(new ErrorHandler("Invalid token", 400));
      }
      const newUser: {
        user: IUser;
        activationCode: string;
        activationCodeCreatedAt: number;
      } = jwt.verify(token, process.env.JWT_SECRET as Secret) as {
        user: IUser;
        activationCode: string;
        activationCodeCreatedAt: number;
      };

      const timeDifference =
        (Date.now() - newUser.activationCodeCreatedAt) / (1000 * 60);

      if (newUser.activationCode !== activationCode || timeDifference > 1) {
        return next(
          new ErrorHandler("Invalid or expired activation code", 400)
        );
      }

      const { name, email, password } = newUser.user;

      const isUserExist = await userModel.findOne({ email });
      if (isUserExist) {
        return next(new ErrorHandler("Email is already exist", 400));
      }

      const createUser = await userModel.create({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
        message: "Account activated successfully",
        user: createUser,
      });
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);

// Login user

interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: any) => {
    try {
      const { email, password }: ILoginRequest = req.body;

      if (!email || !password) {
        return next(new ErrorHandler("Please enter email & password", 400));
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }

      const isPasswordMatched = await user.comparePassword(password);

      if (!isPasswordMatched) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }
      sendToken(res, user, 200);
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);

// Logout user

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: any) => {
    try {
      res.cookie("accessToken", "", {
        maxAge: 1,
      });
      res.cookie("refreshToken", "", {
        maxAge: 1,
      });
      // remove session from redis
      redis.del(req.user._id);
      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);

// update access token

export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: any) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return next(new ErrorHandler("Refresh token not found", 401));
      }

      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN as Secret
      ) as { id: string };

      const session = await redis.get(decoded.id);

      if (!session) {
        return next(new ErrorHandler("Session not found", 404));
      }

      const currentUser: IUser = JSON.parse(session);

      const accessTokenNew = jwt.sign(
        { id: currentUser._id },
        process.env.ACCESS_TOKEN as Secret,
        {
          expiresIn: "5m",
        }
      );

      const refreshTokenNew = jwt.sign(
        { id: currentUser._id },
        process.env.REFRESH_TOKEN as Secret,
        {
          expiresIn: "3d",
        }
      );

      req.user = currentUser;
      //update cookies

      res.cookie("accessToken", accessTokenNew, accessTokenOptions);
      res.cookie("refreshToken", refreshTokenNew, refreshTokenOptions);

      res.status(200).json({
        success: true,
        accessToken: accessTokenNew,
      });
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);

// get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: any) => {
    try {
      getUserById(req.user?._id, res);
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);

// update user info
export interface IUpdateUserInfo {
  name: string;
  email: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { name, email } = req.body as IUpdateUserInfo;
      console.log("Update User triggered ", name, email);
      const user = await userModel.findById(userId);
      if (user && name) {
        user.name = name;
      }
      if (user && email) {
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist) {
          return next(new ErrorHandler("Email is already exist", 400));
        }
        user.email = email;
      }
      await user?.save();

      // update redis
      await redis.set(userId, JSON.stringify(user));

      console.log("User updated successfully -> ", user);
      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        user,
      });
    } catch (err: any) {
      return next(new ErrorHandler(err.message, 400));
    }
  }
);
