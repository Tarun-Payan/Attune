export interface ErrorDetails {
  code?: string;
  fields?: Record<string, string>;
  hint?: string;
  unknown?: string[];
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;

  constructor(
    statusCode = 500,
    message = "Internal Server Error",
    code = "INTERNAL_SERVER_ERROR",
    details?: ErrorDetails,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    this.name = this.constructor.name;

    Error.captureStackTrace?.(this, this.constructor);
  }
}
