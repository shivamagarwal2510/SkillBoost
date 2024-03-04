import { Response } from "express";
import userModel from "../models/user.model";
import { redis } from "../utils/redis";

export const getUserById = async (id: string, res: Response) => {
  const userJSON = await redis.get(id);
  if (!userJSON) {
    return res.status(404).json({ message: "User not found" });
  }
  const user = JSON.parse(userJSON);
  return res.status(201).json({ success: true, user });
};
