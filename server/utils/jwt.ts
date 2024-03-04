require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import { redis } from "./redis";

interface IToken {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax" | "none" | "strict" | undefined;
  secure?: boolean;
}

const accessTokenExpire = parseInt(
  process.env.ACCESS_TOKEN_EXPIRE || "300",
  10
);
const refreshTokenExpire = parseInt(
  process.env.REFRESH_TOKEN_EXPIRE || "1200",
  10
);

const accessTokenExpireDate = new Date(
  Date.now() + accessTokenExpire * 60 * 60 * 1000
);
const refreshTokenExpireDate = new Date(
  Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000
);
export const accessTokenOptions: IToken = {
  expires: accessTokenExpireDate,
  maxAge: accessTokenExpire * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
};
export const refreshTokenOptions: IToken = {
  expires: refreshTokenExpireDate,
  maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
};

export const sendToken = (res: Response, user: IUser, statusCode: number) => {
  const accessToken = user.signAccessToken();
  const refreshToken = user.signRefreshToken();

  //upload session in redis
  redis.set(user._id, JSON.stringify(user) as any);

  if (process.env.NODE_ENV === "production") {
    accessTokenOptions.secure = true;
  }
  res.cookie("accessToken", accessToken, accessTokenOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenOptions);

  res.status(statusCode).json({
    success: true,
    accessToken,
    user,
  });
};
