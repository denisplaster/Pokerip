import { notFound } from "next/navigation";
import { AppError } from "./errors";

/** Awaits a service call, turning NOT_FOUND errors into the Next.js 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}
