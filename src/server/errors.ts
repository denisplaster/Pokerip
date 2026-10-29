export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INSUFFICIENT_FUNDS"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "BAD_REQUEST"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  INSUFFICIENT_FUNDS: 402,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 409,
  BAD_REQUEST: 400,
  INTERNAL: 500,
};

/** An error that is safe to show to the user. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const unauthorized = () => new AppError("UNAUTHORIZED", "Please sign in to continue.");
export const forbidden = (msg = "You don't have permission to do that.") => new AppError("FORBIDDEN", msg);
export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const badRequest = (msg: string, details?: unknown) => new AppError("BAD_REQUEST", msg, details);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);
export const unavailable = (msg: string) => new AppError("UNAVAILABLE", msg);
export const insufficientFunds = (needed: number, balance: number) =>
  new AppError("INSUFFICIENT_FUNDS", `Not enough Rip Coins: this costs ${needed.toLocaleString()} RC but you have ${balance.toLocaleString()} RC.`, {
    needed,
    balance,
  });
