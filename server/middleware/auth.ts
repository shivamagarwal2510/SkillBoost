// make private routes in this middleware

import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { IUser } from "../models/user.model";
import { redis } from "../utils/redis";
import { CatchAsyncError } from "./catchAsyncErrors";

export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.cookies.accessToken;
    console.log("accessToken --> ", accessToken);

    if (!accessToken) {
      return next(new ErrorHandler("Login first to access this resource", 401));
    }

    try {
      const decoded = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN as string
      ) as JwtPayload;

      console.log("decoded --> ", decoded);

      if (!decoded) {
        return next(new ErrorHandler("Access token is not valid", 401));
      }
      const user = await redis.get(decoded.id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      req.user = JSON.parse(user) as IUser;

      next();
    } catch (err: any) {
      return next(
        new ErrorHandler(
          "Login first to access this resource or some error",
          401
        )
      );
    }
  }
);
