import { IUser } from "../models/user.model";
import { Request } from "express";
import { redis } from "./redis";

// define a global variable to hold the user
declare global {
  namespace Express {
    interface Request {
      user: IUser;
    }
  }
}
