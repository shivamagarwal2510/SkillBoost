require("dotenv").config();
import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/user.route";
export const app = express();

// body parser
app.use(express.json({ limit: "50mb" }));
// cookieParser
app.use(cookieParser());
// cors
app.use(cors({ origin: process.env.ORIGIN }));

//routes

app.use("/api/v1", userRouter);

app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  console.log("Running test");
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} is not found`) as any;
  err.statusCode = 404;
  next(err);
});

app.use(ErrorMiddleware);
